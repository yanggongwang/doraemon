import { createApi } from "@ajax";

const prefix = "/api/v1";
export const getSilences = createApi(`${prefix}/sliences`, { method: "get" }); // get list
export const addSilence = createApi(`${prefix}/sliences`); // add
export const deleteSilence = createApi(`${prefix}/sliences/:id`, {
  method: "delete",
}); // delete
export const updateSilence = createApi(`${prefix}/sliences/:id`, {
  method: "put",
}); // update
