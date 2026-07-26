import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GuestRoute } from "./components/layout/GuestRoute";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DataRefreshProvider } from "./context/DataRefreshContext";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DriverDetailPage } from "./pages/drivers/DriverDetailPage";
import { DriversPage } from "./pages/drivers/DriversPage";
import { NewDriverPage } from "./pages/drivers/NewDriverPage";
import { MapPage } from "./pages/map/MapPage";
import { MecanicaPage } from "./pages/mecanica/MecanicaPage";
import { DailySummaryPage } from "./pages/notifications/DailySummaryPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { NewDhlAbServiceRecordPage } from "./pages/records/NewDhlAbServiceRecordPage";
import { NewRecordPage } from "./pages/records/NewRecordPage";
import { RecordDetailPage } from "./pages/records/RecordDetailPage";
import { RecordsListPage } from "./pages/records/RecordsListPage";
import { NewVehiclePage } from "./pages/vehicles/NewVehiclePage";
import { VehicleDetailPage } from "./pages/vehicles/VehicleDetailPage";
import { VehiclesPage } from "./pages/vehicles/VehiclesPage";

// Rutas de detalle/alta que las listas (Registros, Choferes, Vehiculos) pueden abrir
// como overlay superpuesto en vez de reemplazarse a si mismas - ver backgroundLocation
// mas abajo. Comparten path con sus rutas "normales" de mas abajo a proposito: si no
// hay backgroundLocation (entrada directa por URL, o un link que no la pasa, ej. desde
// el Dashboard o el Mapa), esas mismas paginas se siguen sirviendo ahi como pagina
// completa, exactamente como antes de este cambio.
const OverlayRoutes = () => (
  <Routes>
    <Route element={<ProtectedRoute />}>
      <Route path="/records/extras-piazza/new" element={<NewRecordPage />} />
      <Route path="/records/dhl-ab-service/new" element={<NewDhlAbServiceRecordPage />} />
      <Route path="/records/:id" element={<RecordDetailPage />} />
      <Route path="/choferes/new" element={<NewDriverPage />} />
      <Route path="/choferes/:id" element={<DriverDetailPage />} />
      <Route path="/vehiculos/new" element={<NewVehiclePage />} />
      <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
    </Route>
  </Routes>
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

      {backgroundLocation && <OverlayRoutes />}
    </DataRefreshProvider>
  );
}

export default App;
