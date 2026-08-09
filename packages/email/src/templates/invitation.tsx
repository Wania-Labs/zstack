import { Button, Link, Text } from "react-email";

import { EmailLayout } from "./layout";

export type InvitationEmailProps = {
  inviterName: string;
  organizationName: string;
  url: string;
};

export function InvitationEmail({
  inviterName,
  organizationName,
  url,
}: InvitationEmailProps) {
  return (
    <EmailLayout preview={`Join ${organizationName} on zstack`}>
      <Text style={heading}>You're invited</Text>
      <Text style={paragraph}>
        {inviterName} invited you to join <strong>{organizationName}</strong>.
      </Text>
      <Button href={url} style={button}>
        Accept invitation
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

export default InvitationEmail;

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
