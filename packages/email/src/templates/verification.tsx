import { Button, Link, Text } from "react-email";

import { EmailLayout } from "./layout";

export type VerificationEmailProps = {
  name: string;
  url: string;
};

export function VerificationEmail({ name, url }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your email address">
      <Text style={heading}>Verify your email</Text>
      <Text style={paragraph}>Hi {name},</Text>
      <Text style={paragraph}>Confirm your email address to finish setting up your account.</Text>
      <Button href={url} style={button}>
        Verify email
      </Button>
      <Text style={paragraph}>
        Or open this link:{" "}
        <Link href={url} style={link}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default VerificationEmail;

const heading = {
  color: "#111111",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 16px",
} as const;

const paragraph = {
  color: "#333333",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 14px",
} as const;

const button = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "8px 0 18px",
  padding: "12px 18px",
  textDecoration: "none",
} as const;

const link = {
  color: "#111111",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};
