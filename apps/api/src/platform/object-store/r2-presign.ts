import { AwsClient } from "aws4fetch";

export type R2PresignCredentials = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export function readR2PresignCredentials(env: {
  CLOUDFLARE_ACCOUNT_ID?: string | undefined;
  R2_ACCESS_KEY_ID?: string | undefined;
  R2_SECRET_ACCESS_KEY?: string | undefined;
  OBJECTS_BUCKET_NAME?: string | undefined;
}): R2PresignCredentials | undefined {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = env.OBJECTS_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return undefined;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export async function signR2ObjectUrl(input: {
  credentials: R2PresignCredentials;
  key: string;
  method: "PUT" | "GET";
  expiresInSeconds: number;
}): Promise<string> {
  const client = new AwsClient({
    accessKeyId: input.credentials.accessKeyId,
    secretAccessKey: input.credentials.secretAccessKey,
  });
  const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(
    `https://${input.credentials.accountId}.r2.cloudflarestorage.com/${input.credentials.bucketName}/${encodedKey}`,
  );
  url.searchParams.set("X-Amz-Expires", String(input.expiresInSeconds));
  const signed = await client.sign(new Request(url, { method: input.method }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
