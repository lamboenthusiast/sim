export interface ContextSettings {
  background?: string;
  style?: 'casual' | 'professional' | 'flirty' | 'friendly';
  messages?: Message[];
}

export interface Message {
  text: string;
  isFromMe: boolean;
  date: string;
  contactId?: string;
}
