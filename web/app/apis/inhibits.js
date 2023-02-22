import { createApi } from "@ajax";

const prefix = "/api/v1";
/* hibits */
export const getInhibitList = createApi(`${prefix}/inhibits`, {
  method: "get",
}); // get list
export const addInhibits = createApi(`${prefix}/inhibits`); // add
export const getInhibit = createApi(`${prefix}/inhibits/:id`, {
  method: "get",
}); // get by id
export const updateInhibits = createApi(`${prefix}/inhibits/:id`, {
  method: "put",
}); // update
export const deleteInhibits = createApi(`${prefix}/inhibits/:id`, {
  method: "delete",
}); // update
export const getInhibitLogs = createApi(`${prefix}/inhibits/logs`, {
  method: "get",
}); // get inhibit logs
