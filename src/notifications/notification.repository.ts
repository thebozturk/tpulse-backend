import { Notification } from '@prisma/client';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface TransferForNotif {
  id: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  createdByUserId: string | null;
  isRumour: boolean;
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  fromLeagueId: string;
  toLeagueId: string;
}

export interface PreferenceItem {
  eventType: number;
  enabled: boolean;
}

export interface INotificationRepository {
  getForUser(
    userId: string,
    page: number,
    pageSize: number,
    unreadOnly: boolean,
  ): Promise<{ items: Notification[]; total: number }>;
  getUnreadCount(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  getPreferences(userId: string): Promise<PreferenceItem[]>;
  setPreferences(userId: string, prefs: PreferenceItem[]): Promise<void>;

  // generation
  getTransfer(transferId: string): Promise<TransferForNotif | null>;
  findFavouriteUserIds(
    playerId: string,
    teamIds: string[],
    leagueIds: string[],
    reporterId: string | null,
  ): Promise<string[]>;
  getOptedOutUserIds(
    userIds: string[],
    eventType: number,
  ): Promise<Set<string>>;
  createNotification(
    userId: string,
    eventType: number,
    title: string,
    body: string,
    transferId: string,
  ): Promise<boolean>;
}
