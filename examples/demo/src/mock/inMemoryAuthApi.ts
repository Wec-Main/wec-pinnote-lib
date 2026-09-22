import type { AuthApiClient, AuthSession, LoginOption } from "wec-pinnote-lib";

const DEMO_PASSWORD = "pinnote123";
const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

// Mirrors wec-pinnote-api/db/seed.sql so mock mode and a seeded database
// show the same people.
const DEMO_USERS: LoginOption[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Priya Raghavan",
    email: "priya.raghavan@wec.ai",
    roleId: "super_admin",
    organizationId: DEMO_ORGANIZATION_ID,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Hannah Weiss",
    email: "hannah.weiss@wec.ai",
    roleId: "admin",
    organizationId: DEMO_ORGANIZATION_ID,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Marcus Delaney",
    email: "marcus.delaney@wec.ai",
    roleId: "reviewer",
    organizationId: DEMO_ORGANIZATION_ID,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Rahul Menon",
    email: "rahul.menon@wec.ai",
    roleId: "contributor",
    organizationId: DEMO_ORGANIZATION_ID,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Ayesha Khan",
    email: "ayesha.khan@wec.ai",
    roleId: "developer",
    organizationId: DEMO_ORGANIZATION_ID,
  },
];

export function createInMemoryAuthApi(): AuthApiClient {
  return {
    listLoginOptions() {
      return Promise.resolve(DEMO_USERS);
    },

    login(_projectId: string, userId: string, password: string): Promise<AuthSession> {
      const user = DEMO_USERS.find((item) => item.id === userId);
      if (!user || password !== DEMO_PASSWORD) {
        return Promise.reject(new Error("Incorrect password."));
      }
      return Promise.resolve({ ...user });
    },

    logout() {
      return Promise.resolve();
    },
  };
}
