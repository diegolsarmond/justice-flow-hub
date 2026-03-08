import { useMemo } from "react";
import clsx from "clsx";
import { Smartphone, QrCode, ShieldCheck, RefreshCw, Power, Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  deriveSessionName,
  fetchPreferredCompany,
  type CompanySummary,
  disconnectWhatsappInstance,
  provisionWhatsappInstance,
} from "../services/deviceLinkingApi";
import { useWhatsappSessionStatus, type WhatsappSessionStatusResult } from "../hooks/useWhatsappSessionStatus";
import styles from "./DeviceLinkModal.module.css";
import { useToast } from "@/hooks/use-toast";

interface DeviceLinkContentProps {
  isActive: boolean;
  layout?: "modal" | "inline";
  className?: string;
  onClose?: () => void;
  whatsappStatus?: WhatsappSessionStatusResult;
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export const DeviceLinkContent = ({
  isActive,
  layout = "modal",
  className,
  onClose,
  whatsappStatus,
}: DeviceLinkContentProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyNameFromAuth = useMemo(() => {
    const value = user?.empresa_nome;
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [user?.empresa_nome]);

  const companyQuery = useQuery<CompanySummary | null>({
    queryKey: ["companies", "primary"],
    queryFn: fetchPreferredCompany,
    enabled: isActive && !companyNameFromAuth,
  });

  const companyName = companyNameFromAuth ?? companyQuery.data?.name ?? null;
  const sessionName = useMemo(() => deriveSessionName(companyName), [companyName]);

  const resolvedWhatsappStatus = whatsappStatus ?? useWhatsappSessionStatus();
  const qrCodeData = resolvedWhatsappStatus.data;
  const isConnected = resolvedWhatsappStatus.isConnected;
  const isAwaitingProvisioning = resolvedWhatsappStatus.isAwaitingProvisioning;
  const isErrorStatus = resolvedWhatsappStatus.isErrorState;
  const guidanceMessages = qrCodeData?.messages ?? [];
  const statusBadgeClassName = clsx(styles.statusBadge, {
    [styles.statusBadgeConnected]: isConnected,
    [styles.statusBadgePending]: !isConnected && !isErrorStatus,
    [styles.statusBadgeError]: isErrorStatus,
  });
  const statusLabel = resolvedWhatsappStatus.statusLabel;

  const expiresAtLabel = useMemo(() => {
    if (!qrCodeData?.expiresAt) {
      return null;
    }
    const expiresAt = new Date(qrCodeData.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return null;
    }
    return timeFormatter.format(expiresAt);
  }, [qrCodeData?.expiresAt]);

  const steps = useMemo(
    () => [
      {
        title: "Abra o WhatsApp no celular",
        description:
          "No app, toque em Configurações > Dispositivos Conectados e escolha \"Conectar um dispositivo\".",
        icon: <Smartphone size={18} aria-hidden="true" />,
      },
      {
        title: "Escaneie o QR Code",
        description: "Utilize a câmera do aparelho para ler o código exibido no painel do sistema.",
        icon: <QrCode size={18} aria-hidden="true" />,
      },
      {
        title: "Sincronização automática",
        description: "Aguarde alguns instantes até que o WhatsApp sincronize as conversas com o Quantum Jud.",
        icon: <ShieldCheck size={18} aria-hidden="true" />,
      },
      {
        title: "Reconecte quando necessário",
        description:
          "Utilize o botão de reconexão para gerar rapidamente um novo QR Code sempre que o dispositivo for trocado.",
        icon: <RefreshCw size={18} aria-hidden="true" />,
      },
    ],
    [],
  );

  const containerClassName = clsx(
    styles.container,
    layout === "inline" && styles.inlineContainer,
    layout === "modal" && styles.modalBody,
    className,
  );

  const lastUpdatedAt = companyQuery.dataUpdatedAt
    ? timeFormatter.format(new Date(companyQuery.dataUpdatedAt))
    : null;

  const disconnectMutation = useMutation<string | null, Error, void>({
    mutationFn: disconnectWhatsappInstance,
    onSuccess: (message) => {
      resolvedWhatsappStatus.refetch();
      toast({
        title: "Instância desconectada",
        description: message ?? "Gere um novo QR Code para conectar novamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível desconectar",
        description: error.message,
      });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: provisionWhatsappInstance,
    onSuccess: (result) => {
      resolvedWhatsappStatus.refetch();
      toast({
        title: result.alreadyExists ? "Instância já existe" : "Instância criada",
        description: result.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível criar a instância",
        description: error.message,
      });
    },
  });

  const needsRecreation = resolvedWhatsappStatus.isError;
  const showProvisionButton = isAwaitingProvisioning || 
    resolvedWhatsappStatus.connectionState === "unconfigured" ||
    needsRecreation;

  const content = (
    <div className={containerClassName}>
      <div className={styles.instructions}>
        <h2>Como conectar</h2>
        <p>
          O painel suporta múltiplos dispositivos e mantém a sincronização automaticamente. Utilize os passos abaixo
          para vincular o WhatsApp da sua equipe com o Quantum Jud.
        </p>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.stepItem}>
              <span className={styles.stepBadge}>{index + 1}</span>
              <div className={styles.stepContent}>
                <h3>
                  <span className={styles.stepIcon}>{step.icon}</span>
                  {step.title}
                </h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <section className={styles.integrationPanel} aria-labelledby="device-link-integration-title">
        <header className={styles.integrationHeader}>
          <h2 id="device-link-integration-title">Integração com WhatsApp</h2>
        </header>
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            <div>
              <p className={styles.sessionLabel}>Status da integração</p>
              <div className={styles.sessionFeedback}>
                <span className={statusBadgeClassName}>{statusLabel}</span>
                {resolvedWhatsappStatus.isFetching && (
                  <span className={styles.sessionFeedback}>
                    <span className={styles.statusSpinner} aria-hidden="true" />
                    Atualizando…
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className={styles.statusDescription}>
            Vincule um dispositivo autorizado para começar a enviar e receber mensagens pelo Quantum Jud. As informações
            abaixo ajudam o time de suporte a identificar sua empresa durante a configuração.
          </p>
          <div className={styles.sessionMetaRow}>
            <span>
              Empresa:
              <span className={styles.sessionMetaHighlight}> {companyName ?? "Não informada"}</span>
            </span>
            {lastUpdatedAt && (
              <span>
                Atualizado às <span className={styles.sessionMetaHighlight}>{lastUpdatedAt}</span>
              </span>
            )}
          </div>
          <div className={styles.sessionMetaRow}>
            <span>
              Identificador sugerido:
              <span className={styles.sessionMetaHighlight}> {sessionName}</span>
            </span>
          </div>
          {expiresAtLabel && !isConnected && (
            <div className={styles.sessionMetaRow}>
              <span>
                QR Code expira às
                <span className={styles.sessionMetaHighlight}> {expiresAtLabel}</span>
              </span>
            </div>
          )}
          {companyQuery.isError && (
            <p className={styles.sessionWarning} role="alert">
              Não foi possível carregar a empresa padrão. Informe o nome manualmente ao suporte ao solicitar o vínculo.
            </p>
          )}
          {guidanceMessages.map((message) => (
            <p key={message} className={styles.sessionWarning} role="status">
              {message}
            </p>
          ))}
          {!isConnected && !isAwaitingProvisioning && guidanceMessages.length === 0 && (
            <p className={styles.sessionWarning} role="status">
              O dispositivo parece estar desconectado. Gere um novo QR Code e faça a leitura novamente pelo WhatsApp
              para restabelecer a conexão.
            </p>
          )}
        </div>
        <div className={styles.qrSection}>
          <div className={styles.qrHeader}>
            <h3>QR Code de autenticação</h3>
            <div className={styles.qrActions}>
              <button
                type="button"
                className={clsx(styles.qrRefreshButton, styles.qrDisconnectButton)}
                onClick={() => disconnectMutation.mutate()}
                disabled={!isActive || disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                ) : (
                  <Power size={14} aria-hidden="true" />
                )}
                Desconectar instância
              </button>
              <button
                type="button"
                className={styles.qrRefreshButton}
                onClick={() => resolvedWhatsappStatus.refetch()}
                disabled={!isActive || resolvedWhatsappStatus.isFetching}
              >
                {resolvedWhatsappStatus.isFetching ? (
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                ) : (
                  <RefreshCw size={14} aria-hidden="true" />
                )}
                Gerar novo QR Code
              </button>
            </div>
          </div>
          <div className={styles.qrContent}>
            {resolvedWhatsappStatus.isLoading && (
              <div className={styles.sessionFeedback}>
                <span className={styles.statusSpinner} aria-hidden="true" /> Carregando QR Code…
              </div>
            )}
            {resolvedWhatsappStatus.isError && (
              <p className={styles.sessionError} role="alert">
                Não foi possível carregar o QR Code. Tente novamente em alguns instantes.
              </p>
            )}
            {!resolvedWhatsappStatus.isLoading && !resolvedWhatsappStatus.isError && qrCodeData?.qrCode && (
              <img
                className={styles.qrImage}
                src={qrCodeData.qrCode}
                alt="QR Code do WhatsApp"
              />
            )}
            {!resolvedWhatsappStatus.isLoading && !qrCodeData?.qrCode && (
              <div className={styles.qrPlaceholderContainer}>
                <p className={styles.qrPlaceholder}>
                  {needsRecreation
                    ? "Ocorreu um problema com a instância atual. Clique no botão abaixo para recriar a instância e gerar um novo QR Code."
                    : showProvisionButton
                      ? "Nenhuma instância do WhatsApp foi configurada para esta empresa. Clique no botão abaixo para criar uma nova instância."
                      : "Assim que a integração estiver habilitada, o QR Code aparecerá automaticamente neste painel para que você finalize a leitura pelo aplicativo."}
                </p>
                {showProvisionButton && (
                  <button
                    type="button"
                    className={clsx(styles.qrRefreshButton, styles.provisionButton)}
                    onClick={() => provisionMutation.mutate({ force: needsRecreation })}
                    disabled={!isActive || provisionMutation.isPending}
                  >
                    {provisionMutation.isPending ? (
                      <span className={styles.buttonSpinner} aria-hidden="true" />
                    ) : (
                      <Plus size={14} aria-hidden="true" />
                    )}
                    {needsRecreation ? "Recriar instância do WhatsApp" : "Criar instância do WhatsApp"}
                  </button>
                )}
              </div>
            )}
            {!resolvedWhatsappStatus.isLoading && !resolvedWhatsappStatus.isError && qrCodeData?.qrCode && !isConnected && (
              <p className={styles.qrPlaceholder}>
                Abra o WhatsApp, vá em Dispositivos Conectados e escaneie o código para reconectar o atendimento.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  if (layout === "modal" && typeof onClose === "function") {
    return (
      <div className={styles.modalWrapper}>
        <div className={styles.modalHeader}>
          <button type="button" className={styles.modalCloseButton} onClick={onClose}>
            Fechar
          </button>
        </div>
        {content}
      </div>
    );
  }

  return content;
};

interface DeviceLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export const DeviceLinkModal = ({ open, onClose }: DeviceLinkModalProps) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Conectar um novo dispositivo"
      contentClassName={styles.modalContent}
    >
      <DeviceLinkContent isActive={open} layout="modal" onClose={onClose} />
    </Modal>
  );
};
