import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { CerrarServicioModal } from "../../components/horas/CerrarServicioModal";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { AlertTriangleIcon, ClockIcon, EuroIcon, RouteIcon } from "../../components/ui/icons";
import { PayRulesCard } from "../../components/horas/PayRulesCard";
import { parseApiError } from "../../lib/api";
import { COSTO_COLORS, currentMonth, kmSourceLabel, payCalcText } from "../../lib/finanzas";
import { getPagosChoferesRequest } from "../../lib/finanzas.api";
import { formatCurrency, formatDate, formatRomeDateTime } from "../../lib/format";
import { formatHours } from "../../lib/horas";
import { getRecordRequest } from "../../lib/records.api";

const RulesCard = ({ reglas }) => <PayRulesCard reglas={reglas} title="Como se paga" />;

const ServiceCard = ({ service, reglas, onLoadHours, loading }) => {
  const needsLoad = !service.horasEstado || service.horasEstado === "DEVUELTAS";
  return (
    <div className="glass-surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/records/${service.id}`}
            className="block truncate text-[14px] font-semibold text-ink-50 hover:text-accent-300"
          >
            {service.codigo}
          </Link>
          <span className="block truncate text-[12px] text-ink-400">
            {formatDate(service.fecha)} &middot; {[service.cliente, service.destinazione].filter(Boolean).join(" - ")}
          </span>
        </div>
        <HorasEstadoChip estado={service.horasEstado} />
      </div>

      {service.horaInicioReal && service.horaFinReal && (
        <p className="mt-2 text-[12px] text-ink-300">
          Jornada: {formatRomeDateTime(service.horaInicioReal)} &rarr; {formatRomeDateTime(service.horaFinReal)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 text-[12px] text-ink-300">
          {payCalcText(service, reglas)}
          {service.modo === "KM" && service.kmFuente !== "SIN_DATO" && (
            <span className="ml-1.5 rounded bg-line/10 px-1.5 py-0.5 text-[10px] text-ink-400">
              {kmSourceLabel(service.kmFuente)}
            </span>
          )}
          {service.estimadoSiAprobada != null && (
            <span className="mt-0.5 block text-ink-400">
              Si se aprueban tus horas: ~ {formatCurrency(service.estimadoSiAprobada)}
            </span>
          )}
        </div>
        <span className="text-[16px] font-semibold text-ink-50">{formatCurrency(service.total)}</span>
      </div>

      {service.horasNota && (
        <p className="mt-2 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Nota del responsable:</b> {service.horasNota}
        </p>
      )}

      {needsLoad && (
        <Button
          className="mt-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]"
          loading={loading}
          onClick={() => onLoadHours(service.id)}
        >
          {service.horasEstado === "DEVUELTAS" ? "Corregir horas" : "Cargar horas"}
        </Button>
      )}
    </div>
  );
};

// "Mis horas" (chofer): lo trabajado en el mes, lo que se paga, lo que falta cargar y el estado
// de cada servicio.
export const MisHorasPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [modalRecord, setModalRecord] = useState(null);

  const load = useCallback(() => {
    setError("");
    return getPagosChoferesRequest({ month })
      .then((pagos) => setData(pagos))
      .catch((err) => setError(parseApiError(err).message));
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const openLoadHours = async (recordId) => {
    setLoadingId(recordId);
    setError("");
    try {
      setModalRecord(await getRecordRequest(recordId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoadingId(null);
    }
  };

  const me = data?.porChofer[0];
  const servicios = data?.servicios ?? [];
  const sinCargar = servicios.filter((s) => !s.horasEstado).length;
  const devueltas = servicios.filter((s) => s.horasEstado === "DEVUELTAS").length;
  const estimadoPendiente = servicios
    .filter((s) => s.horasEstado === "PENDIENTE")
    .reduce((sum, s) => sum + (s.estimadoSiAprobada ?? 0) - s.total, 0);
  const aDescontar = me?.aDescontar.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Mis horas</h1>
          <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">
            Lo que trabajaste, lo que te corresponde cobrar y lo que falta cargar.
          </p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MancatoKpi
              icon={ClockIcon}
              label="Horas trabajadas"
              value={formatHours(me?.horas ?? 0)}
              detail={`Dia ${formatHours(me?.horasDia ?? 0)} - Noche ${formatHours(me?.horasNoche ?? 0)}`}
              color="#2f8dff"
            />
            <MancatoKpi
              icon={ClockIcon}
              label="Horas de espera"
              value={formatHours(me?.esperaHoras ?? 0)}
              detail="Aprobadas este mes"
              color="#22d3ee"
            />
            <MancatoKpi
              icon={EuroIcon}
              label="Tu pago del mes"
              value={formatCurrency(data.total.total)}
              detail={aDescontar > 0 ? `Neto ${formatCurrency(me?.neto ?? data.total.total)}` : "Base + espera"}
              color={COSTO_COLORS.pagoChoferes}
            />
            <MancatoKpi
              icon={RouteIcon}
              label="Servicios"
              value={data.total.servicios}
              detail="Entregados este mes"
              color="#ff8a1a"
            />
          </div>

          {me?.asistencia && (
            <p className="text-[13px] text-ink-300">
              Asistencia del mes: <b className="text-success-500">{me.asistencia.trabajados}</b> dias trabajados
              {me.asistencia.noTrabajados > 0 && (
                <>
                  {" "}&middot; <b className="text-danger-500">{me.asistencia.noTrabajados}</b> sin justificar
                </>
              )}
              {me.asistencia.justificados > 0 && (
                <>
                  {" "}&middot; <b className="text-warning-500">{me.asistencia.justificados}</b> justificados
                </>
              )}
              .{" "}
              <Link to="/calendario" className="text-accent-400 hover:text-accent-300">
                Ver calendario
              </Link>
            </p>
          )}

          {(sinCargar > 0 || devueltas > 0) && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {sinCargar > 0 &&
                  `${sinCargar} ${sinCargar === 1 ? "servicio sin horas cargadas" : "servicios sin horas cargadas"}`}
                {sinCargar > 0 && devueltas > 0 && " y "}
                {devueltas > 0 &&
                  `${devueltas} ${devueltas === 1 ? "servicio devuelto para corregir" : "servicios devueltos para corregir"}`}
                . Mientras no tengan horas aprobadas se pagan por kilometros.
              </span>
            </div>
          )}

          {estimadoPendiente > 0.5 && (
            <p className="px-1 text-[13px] text-ink-300">
              Tus horas en revision podrian sumar ~ <b className="text-ink-50">{formatCurrency(estimadoPendiente)}</b>{" "}
              mas cuando el responsable las apruebe.
            </p>
          )}

          {aDescontar > 0 && (
            <div className="glass-surface-sm flex flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3 text-[13px] text-ink-300">
              <span>
                Multas a descontar: <b className="text-warning-500">- {formatCurrency(aDescontar)}</b>
              </span>
              <Link to="/finanzas/multas" className="font-medium text-accent-400 hover:text-accent-300">
                Ver detalle &rarr;
              </Link>
            </div>
          )}

          <RulesCard reglas={data.reglas} />

          {servicios.length === 0 ? (
            <p className="px-1 py-6 text-[14px] text-ink-400">No hay servicios entregados en este mes.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {servicios.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  reglas={data.reglas}
                  loading={loadingId === service.id}
                  onLoadHours={openLoadHours}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalRecord && (
        <CerrarServicioModal
          record={modalRecord}
          reglas={data?.reglas}
          onClose={() => setModalRecord(null)}
          onDone={() => load()}
        />
      )}
    </div>
  );
};
