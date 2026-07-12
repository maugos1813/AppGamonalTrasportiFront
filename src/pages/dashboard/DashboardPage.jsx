import { useAuth } from "../../context/AuthContext";
import { ChoferDashboardPage } from "./ChoferDashboardPage";
import { OwnerDashboardPage } from "./OwnerDashboardPage";

export const DashboardPage = () => {
  const { user } = useAuth();

  return user?.cargo === "CHOFER" ? <ChoferDashboardPage /> : <OwnerDashboardPage />;
};
