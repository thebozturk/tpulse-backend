/** Audit aksiyon kataloğu — magic string yerine sabit (CLAUDE.md kuralı). */
export const AuditAction = {
  UserStatus: 'user.status',
  UserRole: 'user.role',
  UserReputation: 'user.reputation',
  PostDelete: 'post.delete',
  CommentDelete: 'comment.delete',
  TransferCommentDelete: 'transferComment.delete',
  ReportReview: 'report.review',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
