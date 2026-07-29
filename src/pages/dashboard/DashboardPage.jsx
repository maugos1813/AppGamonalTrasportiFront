import { lazy, Suspense } from "react";
import { PageLoader } from "../../components/ui/PageLoader";
import { useAuth } from "../../context/AuthContext";

// Lazy: OwnerDashboardPage trae los graficos (recharts). Sin este split, cualquier
// chofer que abre el dashboard descargaria igual ese peso solo por compartir archivo
// con la vista de dueno, aunque nunca la use.
const ChoferDashboardPage = lazy(() =>
  import("./ChoferDashboardPage").then((m) => ({ default: m.ChoferDashboardPage })),
);
const OwnerDashboardPage = lazy(() =>
  import("./OwnerDashboardPage").then((m) => ({ default: m.OwnerDashboardPage })),
);

export const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      {user?.cargo === "CHOFER" ? <ChoferDashboardPage /> : <OwnerDashboardPage />}
    </Suspense>
  );
};
