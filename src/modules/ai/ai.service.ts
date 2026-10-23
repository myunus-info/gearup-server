import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GearItem } from '../gears/entities/gear-item.entity.js';
import type { ChatRequestDto } from './dto/chat-request.dto.js';

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

export interface AiChatResponse {
  reply: string;
  recommendedGearIds: string[];
  recommendedGears: {
    id: string;
    name: string;
    pricePerDay: number;
    category?: string;
  }[];
  model: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(GearItem)
    private readonly gearRepository: Repository<GearItem>,
    private readonly configService: ConfigService,
  ) {}

  async chat(dto: ChatRequestDto): Promise<AiChatResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    // 1. Fetch live in-stock gear catalog directly from database
    const allGears = await this.gearRepository.find({
      where: { isActive: true },
      relations: { category: true },
      take: 30,
    });

    const inStockGears = allGears.filter((g) => (g.quantityAvailable ?? 0) > 0);

    const catalogSnapshot = inStockGears.slice(0, 25).map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category?.name || 'Outdoor Gear',
      price: Number(g.pricePerDay || 0),
      inStock: g.quantityAvailable,
    }));

    // If Gemini key is available, run server-side LLM inference
    if (apiKey) {
      const systemInstruction = `You are the GearUp AI Adventure Concierge, an expert outdoor recreation guide.
Guidelines:
1. Provide warm, helpful, and concise advice (2 to 3 sentences maximum) for expeditions, camping, hiking, water sports, climbing, or photography.
2. Answer platform policy questions accurately:
   - Free cancellation: 100% free cancellation up to 48 hours prior to pickup.
   - Security Deposits: $10 - $80 refundable upon verified equipment return.
   - Damage Protection: Standard protection covers unavoidable trail scuffs with zero liability.
   - Provider Hosting: Providers earn 85% payout and set their own daily rates.
3. CRITICAL CATALOG GROUNDING:
   - You must ONLY recommend products that are explicitly listed in the provided "Current Catalog Snapshot" and have inStock > 0.
   - NEVER invent or mention gear models, brands, or items not present in the snapshot.
   - If the customer asks for equipment not in the snapshot, state that it is currently not in stock, and highlight the closest available gear from our catalog.
   - In your text reply, use the EXACT gear names from the snapshot.
   - In "recommendedGearIds", return only the exact matching 'id' strings from the snapshot.

CRITICAL: Return valid JSON with this exact schema:
{
  "reply": "string (concise, warm 2-3 sentence response referencing ONLY available catalog items)",
  "recommendedGearIds": ["string array of exact matching gear IDs from the catalog snapshot"]
}`;

      const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

      if (dto.history && dto.history.length > 0) {
        for (const h of dto.history.slice(-6)) {
          contents.push({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [
          {
            text: `Current Catalog Snapshot:\n${JSON.stringify(catalogSnapshot)}\n\nCustomer Message: "${dto.message.trim()}"`,
          },
        ],
      });

      for (const model of CANDIDATE_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
              },
              system_instruction: { parts: [{ text: systemInstruction }] },
              contents,
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const parsed = JSON.parse(rawText);
              const recommendedGearIds: string[] = Array.isArray(
                parsed.recommendedGearIds,
              )
                ? parsed.recommendedGearIds
                : [];

              const recommendedGears = inStockGears
                .filter((g) => recommendedGearIds.includes(g.id))
                .slice(0, 3)
                .map((g) => ({
                  id: g.id,
                  name: g.name,
                  pricePerDay: Number(g.pricePerDay),
                  category: g.category?.name || 'Outdoor Gear',
                }));

              return {
                reply: parsed.reply,
                recommendedGearIds,
                recommendedGears,
                model,
              };
            }
          }
        } catch (err: any) {
          this.logger.warn(`Model ${model} attempt failed: ${err.message}`);
        }
      }
    }

    // 2. Intelligent Heuristic Fallback
    const lower = dto.message.toLowerCase();
    let reply =
      "I'd love to help you plan your adventure! You can ask me about camping packages, kayaks, mountain bikes, climbing gear, or camera drones.";
    let matchedGears: GearItem[] = [];

    if (
      lower.includes('camp') ||
      lower.includes('tent') ||
      lower.includes('hike') ||
      lower.includes('pack')
    ) {
      matchedGears = inStockGears.filter(
        (g) =>
          g.name.toLowerCase().includes('tent') ||
          g.name.toLowerCase().includes('pack') ||
          g.category?.name?.toLowerCase().includes('camp'),
      );
      reply =
        'For camping and backpacking excursions, our weather-rated shelters and ergonomic expedition packs keep you comfortable and secure on the trail.';
    } else if (
      lower.includes('water') ||
      lower.includes('kayak') ||
      lower.includes('paddle') ||
      lower.includes('sup')
    ) {
      matchedGears = inStockGears.filter(
        (g) =>
          g.name.toLowerCase().includes('kayak') ||
          g.name.toLowerCase().includes('paddle') ||
          g.name.toLowerCase().includes('sup') ||
          g.category?.name?.toLowerCase().includes('water'),
      );
      reply =
        'Heading out on the water? Our touring kayaks and inflatable SUP paddleboards are fully inspected and ready for coastal or lake adventures.';
    } else if (
      lower.includes('drone') ||
      lower.includes('photo') ||
      lower.includes('camera')
    ) {
      matchedGears = inStockGears.filter(
        (g) =>
          g.name.toLowerCase().includes('drone') ||
          g.name.toLowerCase().includes('camera') ||
          g.category?.name?.toLowerCase().includes('photo'),
      );
      reply =
        'For capturing aerial cinematography, our stabilized 4K action drones and camera equipment ensure cinema-quality outdoor footage.';
    } else if (
      lower.includes('climb') ||
      lower.includes('rope') ||
      lower.includes('harness')
    ) {
      matchedGears = inStockGears.filter(
        (g) =>
          g.name.toLowerCase().includes('climb') ||
          g.name.toLowerCase().includes('rope') ||
          g.name.toLowerCase().includes('harness') ||
          g.category?.name?.toLowerCase().includes('climb'),
      );
      reply =
        'Safety is our top priority for rock and mountaineering routes. Our climbing ropes and harness kits undergo strict inspection before every rental.';
    } else if (lower.includes('bike') || lower.includes('cycling')) {
      matchedGears = inStockGears.filter(
        (g) =>
          g.name.toLowerCase().includes('bike') ||
          g.category?.name?.toLowerCase().includes('cycling'),
      );
      reply =
        'Tackling rugged trails? Our full-suspension mountain bikes feature premium suspension and reliable drivetrains for peak performance.';
    }

    const finalMatched = (
      matchedGears.length > 0 ? matchedGears : inStockGears
    ).slice(0, 2);

    return {
      reply,
      recommendedGearIds: finalMatched.map((g) => g.id),
      recommendedGears: finalMatched.map((g) => ({
        id: g.id,
        name: g.name,
        pricePerDay: Number(g.pricePerDay),
        category: g.category?.name || 'Outdoor Gear',
      })),
      model: 'heuristic-engine',
    };
  }
}
