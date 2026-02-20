import { Controller, Get, Request, Response, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const redirect = process.env.AUTH_GOOGLE_SUCCESS_REDIRECT;
    if (redirect) {
      return res.redirect(redirect);
    }
    return res.json(req.user);
  }
}
