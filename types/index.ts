export type WhatsAppConnectionStatus = "not_connected" | "connecting" | "connected";

export interface WhatsAppConnection {
  id: string;
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  webhookVerified: boolean;
  connectedAt: string;
}

export interface Conversation {
  id: string;
  businessId: string;
  customerPhone: string;
  customerName: string | null;
  status: "open" | "closed";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  businessId: string;
  direction: "inbound" | "outbound";
  whatsappMessageId: string | null;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  body: string | null;
  status: string | null;
  createdAt: string;
}
export interface Business {
  id: string;
  ownerId: string;
  businessName: string;
  phone: string;
  trade: "plumbing";
  openingTime: string;
  closingTime: string;
  offersEmergencyCallouts: boolean;
  serviceAreas: string[];
  logoUrl: string | null;
  greetingStyle: "professional" | "friendly" | "concise";
  businessDescription: string;
  services: string[];
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
  whatsappConnected: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}
