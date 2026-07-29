import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GuestRoute } from "./components/layout/GuestRoute";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { PageLoader } from "./components/ui/PageLoader";
import { DataRefreshProvider } from "./context/DataRefreshContext";

// Paginas cargadas de forma perezosa (React.lazy): antes se importaban todas de
// forma estatica y Vite las metia junto con sus dependencias (recharts, Google Maps,
// etc.) en un unico bundle de ~1.2MB que se descargaba antes de poder ver siquiera el
// login. Con lazy(), cada pagina (y lo que solo ella usa) se descarga recien cuando el
// usuario navega a esa ruta.
const ForgotPasswordPage = lazy(() =>
  import("./pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() =>
  import("./pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DriverDetailPage = lazy(() =>
  import("./pages/drivers/DriverDetailPage").then((m) => ({ default: m.DriverDetailPage })),
);
const DriversPage = lazy(() => import("./pages/drivers/DriversPage").then((m) => ({ default: m.DriversPage })));
const NewDriverPage = lazy(() =>
  import("./pages/drivers/NewDriverPage").then((m) => ({ default: m.NewDriverPage })),
);
const MapPage = lazy(() => import("./pages/map/MapPage").then((m) => ({ default: m.MapPage })));
const MecanicaPage = lazy(() => import("./pages/mecanica/MecanicaPage").then((m) => ({ default: m.MecanicaPage })));
const DailySummaryPage = lazy(() =>
  import("./pages/notifications/DailySummaryPage").then((m) => ({ default: m.DailySummaryPage })),
);
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const NewDhlAbServiceRecordPage = lazy(() =>
  import("./pages/records/NewDhlAbServiceRecordPage").then((m) => ({ default: m.NewDhlAbServiceRecordPage })),
);
const NewExtrasStefaniaRecordPage = lazy(() =>
  import("./pages/records/NewExtrasStefaniaRecordPage").then((m) => ({ default: m.NewExtrasStefaniaRecordPage })),
);
const NewRecordPage = lazy(() =>
  import("./pages/records/NewRecordPage").then((m) => ({ default: m.NewRecordPage })),
);
const RecordDetailPage = lazy(() =>
  import("./pages/records/RecordDetailPage").then((m) => ({ default: m.RecordDetailPage })),
);
const RecordsListPage = lazy(() =>
  import("./pages/records/RecordsListPage").then((m) => ({ default: m.RecordsListPage })),
);
const NewVehiclePage = lazy(() =>
  import("./pages/vehicles/NewVehiclePage").then((m) => ({ default: m.NewVehiclePage })),
);
const VehicleDetailPage = lazy(() =>
  import("./pages/vehicles/VehicleDetailPage").then((m) => ({ default: m.VehicleDetailPage })),
);
const VehiclesPage = lazy(() => import("./pages/vehicles/VehiclesPage").then((m) => ({ default: m.VehiclesPage })));

// Rutas de detalle/alta que las listas (Registros, Choferes, Vehiculos) pueden abrir
// como overlay superpuesto en vez de reemplazarse a si mismas - ver backgroundLocation
// mas abajo. Comparten path con sus rutas "normales" de mas abajo a proposito: si no
// hay backgroundLocation (entrada directa por URL, o un link que no la pasa, ej. desde
// el Dashboard o el Mapa), esas mismas paginas se siguen sirviendo ahi como pagina
// completa, exactamente como antes de este cambio.
const OverlayRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/records/extras-piazza/new" element={<NewRecordPage />} />
        <Route path="/records/dhl-ab-service/new" element={<NewDhlAbServiceRecordPage />} />
        <Route path="/records/extras-stefania/new" element={<NewExtrasStefaniaRecordPage />} />
        <Route path="/records/:id" element={<RecordDetailPage />} />
        <Route path="/choferes/new" element={<NewDriverPage />} />
        <Route path="/choferes/:id" element={<DriverDetailPage />} />
        <Route path="/vehiculos/new" element={<NewVehiclePage />} />
        <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
      </Route>
    </Routes>
  </Suspense>
);

function App() {
  const location = useLocation();
  // Al navegar a un detalle/alta desde una lista (RecordsListPage/DriversPage/
  // VehiclesPage pasan backgroundLocation en el "state" del Link), la lista sigue
  // pintandose de fondo con la location de ANTES de navegar (nunca se desmonta, no
  // pierde su estado/no repite fetches) y el detalle/alta se superpone encima en un
  // <Routes> aparte con la location real - patron estandar de "modal route" de
  // react-router.
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <DataRefreshProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes location={backgroundLocation ?? location}>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/resumen" element={<DailySummaryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/records" element={<Navigate to="/records/extras-piazza" replace />} />
              <Route path="/records/extras-piazza" element={<RecordsListPage section="extras-piazza" />} />
              <Route path="/records/extras-piazza/new" element={<NewRecordPage />} />
              <Route path="/records/dhl-ab-service" element={<RecordsListPage section="dhl-ab-service" />} />
              <Route path="/records/dhl-ab-service/new" element={<NewDhlAbServiceRecordPage />} />
              <Route path="/records/extras-stefania" element={<RecordsListPage section="extras-stefania" />} />
              <Route path="/records/extras-stefania/new" element={<NewExtrasStefaniaRecordPage />} />
              <Route path="/records/:id" element={<RecordDetailPage />} />
              <Route path="/choferes" element={<DriversPage />} />
              <Route path="/choferes/new" element={<NewDriverPage />} />
              <Route path="/choferes/:id" element={<DriverDetailPage />} />
              <Route path="/vehiculos" element={<VehiclesPage />} />
              <Route path="/vehiculos/new" element={<NewVehiclePage />} />
              <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
              <Route path="/mapa" element={<MapPage />} />
              <Route path="/mecanica" element={<MecanicaPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {backgroundLocation && <OverlayRoutes />}
    </DataRefreshProvider>
  );
}

export default App;
