export interface ClienteRecord {
  id: number;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  descricao?: string | null;
}

export const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

export const getNameFromEmail = (
  email: string | null | undefined,
): string | undefined => {
  if (!email || typeof email !== "string") {
    return undefined;
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return undefined;
  }
  const [localPart] = trimmed.split("@");
  if (!localPart) {
    return undefined;
  }
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
};

export const buildClientDisplayName = (client: ClienteRecord): string => {
  const resolved =
    pickFirstNonEmptyString(
      client.nome,
      getNameFromEmail(client.email),
      client.documento,
      client.telefone,
      client.descricao,
    ) ?? `Cliente #${client.id}`;
  return resolved;
};

export interface ClientDisplayData {
  id: number;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
}

export const mapClienteRecordToDisplayData = (
  client: ClienteRecord,
): ClientDisplayData => ({
  id: client.id,
  name: buildClientDisplayName(client),
  document:
    typeof client.documento === "string" && client.documento.trim().length > 0
      ? client.documento.trim()
      : null,
  email:
    typeof client.email === "string" && client.email.trim().length > 0
      ? client.email.trim()
      : null,
  phone:
    typeof client.telefone === "string" && client.telefone.trim().length > 0
      ? client.telefone.trim()
      : null,
});
