import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Lang, resolveLang } from './lang';

/**
 * Controller'da gösterim dili: @ReqLang() lang: Lang.
 * `Accept-Language` header'ından çözülür; yoksa varsayılan Türkçe.
 */
export const ReqLang = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Lang => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return resolveLang(request.headers['accept-language']);
  },
);
