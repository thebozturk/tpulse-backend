import { Prisma, TransferPeriod } from '@prisma/client';
import { TransferWithRel } from '../transfer.repository';

export const STATS_REPOSITORY = Symbol('STATS_REPOSITORY');

export interface AggregateResult {
  totalTransfers: number;
  totalSpent: number;
  averageFee: number;
  maxFee: number;
  minFee: number;
}

export interface TeamCount {
  teamId: string;
  teamName: string;
  count: number;
}

export interface PlayerCount {
  playerId: string;
  playerName: string;
  count: number;
}

export interface IStatsRepository {
  aggregate(where: Prisma.TransferWhereInput): Promise<AggregateResult>;
  topByFee(where: Prisma.TransferWhereInput): Promise<TransferWithRel | null>;
  edge(
    where: Prisma.TransferWhereInput,
    order: 'asc' | 'desc',
  ): Promise<TransferWithRel | null>;
  mostActiveTeam(
    where: Prisma.TransferWhereInput,
    direction: 'buyer' | 'seller',
  ): Promise<TeamCount | null>;
  mostTransferredPlayer(
    where: Prisma.TransferWhereInput,
  ): Promise<PlayerCount | null>;
  listInRange(where: Prisma.TransferWhereInput): Promise<TransferWithRel[]>;
  getPeriods(year?: number): Promise<TransferPeriod[]>;
  getPeriodById(id: string): Promise<TransferPeriod | null>;
  createPeriod(data: PeriodWriteInput): Promise<TransferPeriod>;
  updatePeriod(
    id: string,
    data: PeriodWriteInput,
  ): Promise<TransferPeriod | null>;
  deletePeriod(id: string): Promise<boolean>;
}

export interface PeriodWriteInput {
  name: string;
  periodType?: string;
  startDate: Date;
  endDate: Date;
}
