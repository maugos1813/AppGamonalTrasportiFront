import { parseApiError } from "../../lib/api";
import { createClientRequest } from "../../lib/clients.api";
import { SearchableSelect } from "./SearchableSelect";

// Combobox de cliente: escribir filtra sugerencias existentes, y al aceptar
// (blur, Enter, o click en "Crear cliente") lo crea en la base si no existe todavia.
export const ClientAutocomplete = ({ id, label, clients, value, onChange, onClientCreated, error }) => {
  const options = clients.map((c) => ({ value: c.id, label: c.nombre }));

  const handleCreateNew = async (name) => {
    try {
      const client = await createClientRequest(name);
      onClientCreated(client);
      return { value: client.id, label: client.nombre };
    } catch (err) {
      throw new Error(parseApiError(err).message);
    }
  };

  return (
    <SearchableSelect
      id={id}
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      onCreateNew={handleCreateNew}
      createLabel={(text) => `+ Crear cliente "${text}"`}
      placeholder="Escribe para buscar o crear un cliente"
      error={error}
    />
  );
};
