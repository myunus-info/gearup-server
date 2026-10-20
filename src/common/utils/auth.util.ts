import type { Response } from 'express';

export interface CookieData {
  type: 'login' | 'logout';
  res: Response;
  accessToken?: string;
  refreshToken?: string;
}

export function handleCookies({ type, res, accessToken, refreshToken }: CookieData) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    partitioned: isProduction,
    path: '/',
  };

  if (type === 'login') {
    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
  } else {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
  }
}
