import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Github, Linkedin, Mail, MapPin, Phone } from "lucide-react";

import quantumLogo from "@/assets/logo-interna.png";
import { routes } from "@/config/routes";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";

const currentYear = new Date().getFullYear();

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const subscriptionStorageKey = useMemo(
    () => getSubscriptionStorageKey(user),
    [user?.empresa_id, user?.id],
  );

  const handleMyPlanClick = () => {
    if (typeof window !== "undefined") {
      const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
      for (const key of additionalKeys) {
        localStorage.removeItem(key);
      }

      const storedId = localStorage.getItem(subscriptionStorageKey);
      if (storedId && storedId.trim().length > 0) {
        navigate(routes.subscription(storedId.trim()));
        return;
      }
    }

    navigate(routes.plans);
  };

  return (
    <footer className="border-t border-border/40 bg-background/80">
      <div className="container grid gap-8 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-4">
          <Link to={routes.home} className="flex items-center gap-3">
            <img src={quantumLogo} alt="Quantum Tecnologia" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-foreground">Quantum Tecnologia</span>
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            Soluções tecnológicas impulsionadas por IA. CRM Jurídico, automações inteligentes e desenvolvimento sob medida.
          </p>
          <address className="space-y-2 text-sm text-muted-foreground not-italic">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <span>R. Antônio de Albuquerque, 330 - Sala 901 - Savassi, Belo Horizonte - MG, 30112-010</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" aria-hidden />
              <a href="tel:+5531993054200" className="transition hover:text-foreground">
                (31) 99305-4200
              </a>
            </div>
          </address>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/quantumtecnologia/"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <a
              href="https://github.com/quantumtecnologia"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="mailto:contato@quantumtecnologia.com"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Enviar email"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Plataforma</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to={routes.login} className="transition hover:text-foreground">
                Entrar na plataforma
              </Link>
            </li>
            <li>
              <Link to={routes.register} className="transition hover:text-foreground">
                Criar conta grátis
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={handleMyPlanClick}
                className="transition hover:text-foreground text-left text-current bg-transparent p-0"
              >
                Meu plano
              </button>
            </li>
            <li>
              <Link to="/suporte" className="transition hover:text-foreground">
                Suporte
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Recursos</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to={{ pathname: routes.home, hash: "#planos" }} className="transition hover:text-foreground">
                Funcionalidades
              </Link>
            </li>
            <li>
              <Link to={routes.plans} className="transition hover:text-foreground">
                Planos e Preços
              </Link>
            </li>
            <li>
              <Link to={routes.blog} className="transition hover:text-foreground">
                Blog
              </Link>
            </li>
            <li>
              <Link to={{ pathname: routes.home, hash: "#contato" }} className="transition hover:text-foreground">
                Contato
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40 bg-background/60">
        <div className="container flex flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-muted-foreground md:flex-row">
          <span>
            &copy; {currentYear} Quantum Tecnologia. Todos os direitos reservados.
          </span>
          <div className="flex gap-4">
            <Link to={routes.privacyPolicy} className="transition hover:text-foreground">
              Política de privacidade
            </Link>
            <Link to={routes.termsOfUse} className="transition hover:text-foreground">
              Termos de uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
