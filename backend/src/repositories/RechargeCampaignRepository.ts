import type { RechargeCampaign } from '../domain/recharge/RechargeCampaign.js'

export interface RechargeCampaignRepository {
  findEffectiveCampaigns(amount: number, now: Date): Promise<readonly RechargeCampaign[]>
  findAll(): Promise<readonly RechargeCampaign[]>
  findById(id: string): Promise<RechargeCampaign | null>
  save(campaign: RechargeCampaign): Promise<void>
}
