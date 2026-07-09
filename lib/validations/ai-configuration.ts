import { z } from "zod";

export const faqSchema = z.object({
  question: z.string().min(3, "Question is too short"),
  answer: z.string().min(3, "Answer is too short"),
});
export type Faq = z.infer<typeof faqSchema>;

export const aiConfigurationSchema = z.object({
  tone: z.enum(["professional", "friendly", "concise"]),
  systemPrompt: z.string().min(10, "Give the AI at least a sentence to work with"),
  businessRules: z.string().optional().default(""),
  escalationRules: z.string().optional().default(""),
  faqs: z.array(faqSchema).default([]),
});
export type AiConfigurationInput = z.infer<typeof aiConfigurationSchema>;
