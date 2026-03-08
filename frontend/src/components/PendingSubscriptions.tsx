import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";

const PendingSubscriptions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const subscriptionStorageKey = useMemo(
    () => getSubscriptionStorageKey(user),
    [user?.empresa_id, user?.id],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
    for (const key of additionalKeys) {
      localStorage.removeItem(key);
    }

    const storedId = localStorage.getItem(subscriptionStorageKey);
    if (storedId) {
      setSubscriptionId(storedId);
    }
  }, [subscriptionStorageKey, user?.empresa_id, user?.id]);

  if (!subscriptionId) {
    return null;
  }

  return (
    <Alert className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-accent/30 bg-accent/10">
      <div>
        <AlertTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            Assinatura pendente
          </Badge>
          Retome seu pagamento
        </AlertTitle>
        <AlertDescription>
          Identificamos uma assinatura ainda não finalizada. Você pode continuar o processo de pagamento agora mesmo.
        </AlertDescription>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(`/subscription/${subscriptionId}`)}>
          Ver detalhes
        </Button>
        <Button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem(subscriptionStorageKey);
              const additionalKeys = getAdditionalSubscriptionStorageKeys(
                user,
                subscriptionStorageKey,
              );
              for (const key of additionalKeys) {
                localStorage.removeItem(key);
              }
              localStorage.removeItem("customerId");
              setSubscriptionId(null);
            }
          }}
        >
          Limpar alerta
        </Button>
      </div>
    </Alert>
  );
};

export default PendingSubscriptions;
