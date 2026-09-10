import { describe, expect, it } from "vitest";
import { resolveWorkspaceDestination, type AccountNavContext } from "./destination";

describe("coach dashboard entry", () => {
  const context: AccountNavContext = {
    id:"player",email:"test@example.invalid",fullName:null,avatarPath:null,avatarUpdatedAt:null,avatarUrl:null,
    coaches:[{id:"coach",name:"Coach"}],venues:[],isAdmin:false,
    preference:{type:"personal",entityId:null},
  };
  it("opens the single coach dashboard despite an old personal preference", () => {
    expect(resolveWorkspaceDestination(context)).toBe("/account/coaches/coach");
  });
  it("keeps authorised admin preference", () => {
    expect(resolveWorkspaceDestination({...context,isAdmin:true,preference:{type:"admin",entityId:null}})).toBe("/admin");
  });
  it("keeps venue workspace switching for accounts with both roles", () => {
    expect(resolveWorkspaceDestination({...context,venues:[{id:"venue",name:"Venue"}],preference:{type:"venue",entityId:"venue"}})).toBe("/account/venues/venue");
  });
});
