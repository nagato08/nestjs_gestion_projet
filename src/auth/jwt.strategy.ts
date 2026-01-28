/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

export type UserPayload = {
  sub: string;
  id: string;
  email: string;
  role: string;
  department: string;
};
export type RequestWithUser = {
  user: UserPayload;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'ZO44bPd3LB6SdTgaLo7I9OIxQSKfp1_u3l_ri6hJmXw',
    };

    super(options);
  }

  validate(payload: any) {
    return {
      sub: payload.sub,
      id: payload.sub, // Alias pour compatibilité avec req.user.id
      email: payload.email,
      role: payload.role,
      department: payload.department,
    };
  }
}
