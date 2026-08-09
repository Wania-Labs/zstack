import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

type EmailLayoutProps = {
  preview: string;
  children: ReactNode;
};

/**
 * Shared transactional shell. Keep provider-neutral; brand tokens stay minimal for now.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>zstack</Text>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>This message was sent by zstack.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  margin: "0",
  padding: "24px 0",
} as const;

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px 28px",
} as const;

const brand = {
  color: "#111111",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: "0 0 24px",
} as const;

const hr = {
  borderColor: "#eaeaea",
  margin: "28px 0 16px",
} as const;

const footer = {
  color: "#888888",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
} as const;
