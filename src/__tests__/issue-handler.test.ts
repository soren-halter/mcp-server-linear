import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { IssueHandler } from "../features/issues/handlers/issue.handler";
import { LinearAuth } from "../auth";
import { LinearGraphQLClient } from "../graphql/client";
import { SearchIssuesResponse } from "../features/issues/types/issue.types";

describe("IssueHandler", () => {
  let issueHandler: IssueHandler;
  let mockAuth: LinearAuth;
  let mockGraphqlClient: LinearGraphQLClient;
  let mockSearchIssues: jest.Mock;

  const mockSearchResponse: SearchIssuesResponse = {
    issues: {
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
      nodes: [
        {
          id: "issue-1",
          identifier: "TEST-1",
          title: "Test Issue with Label",
          url: "https://linear.app/test/issue/TEST-1",
          state: {
            id: "state-1",
            name: "In Progress",
            type: "started",
            color: "#f2c94c",
          },
          labels: {
            nodes: [
              {
                id: "label-1",
                name: "Cows out of break - GPS issue",
                color: "#f2994a",
              },
            ],
          },
        },
      ],
    },
  };

  beforeEach(() => {
    mockSearchIssues = jest.fn<() => Promise<SearchIssuesResponse>>().mockResolvedValue(mockSearchResponse);

    mockGraphqlClient = {
      searchIssues: mockSearchIssues,
    } as unknown as LinearGraphQLClient;

    mockAuth = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue({}),
      needsTokenRefresh: jest.fn().mockReturnValue(false),
      refreshAccessToken: jest.fn(),
    } as unknown as LinearAuth;

    issueHandler = new IssueHandler(mockAuth, mockGraphqlClient);
  });

  describe("handleSearchIssues with label filtering", () => {
    it("should filter by exact label names using labelNames", async () => {
      const result = await issueHandler.handleSearchIssues({
        labelNames: ["Bug", "Frontend"],
        first: 10,
      });

      expect(mockSearchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: { some: { name: { in: ["Bug", "Frontend"] } } },
        }),
        10,
        undefined,
        "updatedAt"
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it("should filter by label name containing text using labelNameContains", async () => {
      const result = await issueHandler.handleSearchIssues({
        labelNameContains: "cows out of break",
        first: 20,
      });

      expect(mockSearchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: {
            some: { name: { containsIgnoreCase: "cows out of break" } },
          },
        }),
        20,
        undefined,
        "updatedAt"
      );

      expect(result).toBeDefined();
    });

    it("should combine label filtering with other filters", async () => {
      const result = await issueHandler.handleSearchIssues({
        labelNameContains: "GPS issue",
        teamIds: ["team-1", "team-2"],
        states: ["In Progress", "Todo"],
        first: 50,
      });

      expect(mockSearchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: { some: { name: { containsIgnoreCase: "GPS issue" } } },
          team: { id: { in: ["team-1", "team-2"] } },
          state: { name: { in: ["In Progress", "Todo"] } },
        }),
        50,
        undefined,
        "updatedAt"
      );

      expect(result).toBeDefined();
    });

    it("should use labelNameContains over labelNames when both provided", async () => {
      const result = await issueHandler.handleSearchIssues({
        labelNames: ["Bug"],
        labelNameContains: "cows out of break",
        first: 10,
      });

      // labelNameContains should overwrite labelNames since it comes after in the code
      expect(mockSearchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: {
            some: { name: { containsIgnoreCase: "cows out of break" } },
          },
        }),
        10,
        undefined,
        "updatedAt"
      );
    });

    it("should not include labels filter when no label params provided", async () => {
      const result = await issueHandler.handleSearchIssues({
        teamIds: ["team-1"],
        first: 10,
      });

      expect(mockSearchIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          team: { id: { in: ["team-1"] } },
        }),
        10,
        undefined,
        "updatedAt"
      );

      // Verify labels filter is not present
      const callArgs = mockSearchIssues.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("labels");
    });

    it("should handle empty labelNames array", async () => {
      const result = await issueHandler.handleSearchIssues({
        labelNames: [],
        first: 10,
      });

      // Empty array should not add labels filter
      const callArgs = mockSearchIssues.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("labels");
    });
  });
});
