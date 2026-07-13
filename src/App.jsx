import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GuestRoute } from "./components/layout/GuestRoute";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DriverDetailPage } from "./pages/drivers/DriverDetailPage";
import { DriversPage } from "./pages/drivers/DriversPage";
import { NewDriverPage } from "./pages/drivers/NewDriverPage";
import { MapPage } from "./pages/map/MapPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { NewRecordPage } from "./pages/records/NewRecordPage";
import { RecordDetailPage } from "./pages/records/RecordDetailPage";
import { RecordsListPage } from "./pages/records/RecordsListPage";
import { NewVehiclePage } from "./pages/vehicles/NewVehiclePage";
import { VehicleDetailPage } from "./pages/vehicles/VehicleDetailPage";
import { VehiclesPage } from "./pages/vehicles/VehiclesPage";

function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/records" element={<RecordsListPage />} />
          <Route path="/records/new" element={<NewRecordPage />} />
          <Route path="/records/:id" element={<RecordDetailPage />} />
          <Route path="/choferes" element={<DriversPage />} />
          <Route path="/choferes/new" element={<NewDriverPage />} />
          <Route path="/choferes/:id" element={<DriverDetailPage />} />
          <Route path="/vehiculos" element={<VehiclesPage />} />
          <Route path="/vehiculos/new" element={<NewVehiclePage />} />
          <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
          <Route path="/mapa" element={<MapPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
