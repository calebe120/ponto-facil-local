export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo" as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatYmdInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

export const formatDateBRFromYMD = (dateYmd: string) => {
  const [year, month, day] = dateYmd.split("-");
  if (!year || !month || !day) return dateYmd;
  return `${day}/${month}/${year}`;
};

export const getSaoPauloTodayYMD = () => formatYmdInTimeZone(new Date(), SAO_PAULO_TIME_ZONE);

export const getSaoPauloNowTimeHM = () => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;

  if (!hour || !minute) return "";
  return `${hour}:${minute}`;
};

export const getSaoPauloNowFullDatePtBr = () =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

export const getMonthRangeFromYMD = (dateYmd: string): { firstDay: string; lastDay: string } => {
  const [y, m] = dateYmd.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) {
    return { firstDay: dateYmd, lastDay: dateYmd };
  }

  const lastDayNum = new Date(year, month, 0).getDate();
  const mm = pad2(month);

  return {
    firstDay: `${year}-${mm}-01`,
    lastDay: `${year}-${mm}-${pad2(lastDayNum)}`,
  };
};

export const getMonthLabelPtBrFromYMD = (dateYmd: string) => {
  const [y, m] = dateYmd.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return "";

  // Use a "safe" UTC midday date so it doesn't shift month when formatted.
  const safe = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(safe);
};
