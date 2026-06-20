import type { ComponentType } from 'react'
import ScanReadyEmail from './scan-ready'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'scan-ready': {
    component: ScanReadyEmail,
    subject: (d) => `Your competitor scan for ${d.domain} is ready`,
    displayName: 'Scan ready',
    previewData: {
      domain: 'glossier.com',
      advertiserCount: 47,
      estMonthlySpend: 184000,
      primaryChannel: 'Meta',
      dashboardUrl: 'https://revenuad.com/app/advertisers?domain=glossier.com',
      recipientName: 'Alex',
    },
  },
}
