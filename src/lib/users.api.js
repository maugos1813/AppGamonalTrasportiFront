import { api } from "./api";

export const listUsersRequest = () =>
  api.get("/users").then((res) => res.data.data.users);

export const createUserRequest = (payload) =>
  api.post("/users", payload).then((res) => res.data.data.user);

export const getUserRequest = (id) =>
  api.get(`/users/${id}`).then((res) => res.data.data.user);

export const updateUserRequest = (id, payload) =>
  api.patch(`/users/${id}`, payload).then((res) => res.data.data.user);

export const uploadUserAvatarRequest = (id, file) => {
  const formData = new FormData();
  formData.append("imagen", file);
  return api.post(`/users/${id}/avatar`, formData).then((res) => res.data.data.user);
};
