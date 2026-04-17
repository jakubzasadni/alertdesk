import Keycloak from "keycloak-js";

let _keycloak: Keycloak | null = null;

export function initKeycloak(url: string, realm: string, clientId: string): Keycloak {
  if (!_keycloak) {
    _keycloak = new Keycloak({ url, realm, clientId });
  }
  return _keycloak;
}

export function getKeycloak(): Keycloak | null {
  return _keycloak;
}
