"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Icon,
  Modal,
  ModalSize,
  Switch,
} from "@gouvfr-lasuite/ui-components";
import { useCommune } from "@/contexts/CommuneContext";
import { formatCommuneName } from "@/lib/geo/commune";
import styles from "./CommuneSettings.module.css";
import Image from "next/image";

interface CommuneSettingsProps {
  currentPluginId?: string;
  communeFlagUrl: string;
}

export function CommuneSettings({
  currentPluginId,
  communeFlagUrl,
}: CommuneSettingsProps) {
  const commune = useCommune();
  const communeName = formatCommuneName(commune.nom);
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialEnabled = useMemo(
    () =>
      Object.fromEntries(
        commune.plugins.map((p) => [p.id, p.enabled]),
      ) as Record<string, boolean>,
    [commune.plugins],
  );
  const [enabledById, setEnabledById] =
    useState<Record<string, boolean>>(initialEnabled);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setEnabledById(initialEnabled);
      setError(null);
    }
  }

  const handleClose = () => {
    if (saving) return;
    setIsOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const disabledPlugins = commune.plugins
      .filter((p) => p.id !== currentPluginId && !enabledById[p.id])
      .map((p) => p.id);
    try {
      const res = await fetch("/api/commune/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledPlugins }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Enregistrement impossible.");
      }
      setIsOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        color="neutral"
        variant="tertiary"
        size="small"
        icon={
          <Image
            src={communeFlagUrl}
            alt={`Blason de ${communeName}`}
            width={24}
            height={24}
          />
        }
        aria-label={`Paramètres de ${communeName} (${commune.codeInsee})`}
      />
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size={ModalSize.MEDIUM}
        title={`Paramètres de ${communeName} (${commune.codeInsee})`}
        rightActions={
          <>
            <Button
              variant="secondary"
              color="neutral"
              onClick={handleClose}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
      >
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Modules activés</h3>
          <p className={styles.sectionHint}>
            Choisissez les modules disponibles pour cette commune.
          </p>
          <ul className={styles.pluginList}>
            {commune.plugins.map((p) => (
              <li key={p.id} className={styles.pluginRow}>
                <span aria-hidden className={styles.pluginIcon}>
                  {p.icon}
                </span>
                <span className={styles.pluginLabel}>{p.label}</span>
                <Switch
                  aria-label={`Activer le module ${p.label}`}
                  checked={
                    p.id === currentPluginId
                      ? true
                      : (enabledById[p.id] ?? false)
                  }
                  onChange={(e) =>
                    setEnabledById((prev) => ({
                      ...prev,
                      [p.id]: (e.target as HTMLInputElement).checked,
                    }))
                  }
                  disabled={saving || p.id === currentPluginId}
                />
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Blason de la commune</h3>
          <p className={styles.sectionHint}>
            Vous souhaitez modifier le blason de cette commune ?{" "}
            <a
              href="https://collectivite.fr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              C&apos;est par ici
            </a>
          </p>
        </div>
      </Modal>
    </>
  );
}
