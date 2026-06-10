import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * "Senin İçin" feed query'si. Şimdilik yalnızca sayfalama; ileride
 * (faz 2) client-sent seenIds eklenecek.
 */
export class FeedQueryDto extends PaginationQueryDto {}
