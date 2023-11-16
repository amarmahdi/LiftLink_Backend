/* eslint-disable @typescript-eslint/no-explicit-any */
// Import necessary modules and types
import { MyContext } from "../helpers/MyContext";
import { AssignedOrders } from "../entity/AssignedOrder";
import { ApolloError } from "apollo-server-core";
import { AssignResolver } from "../resolvers/AssignResolver";
import { describe, expect } from "@jest/globals";
import { mock } from "jest-mock-extended";
import { Repository } from "typeorm";
import * as typeorm from "typeorm";

// Mock the entire typeorm module
jest.mock("typeorm", () => ({
  ...jest.requireActual("typeorm"),
  getRepository: jest.fn(),
  __esModule: true,
}));

describe("AssignResolver", () => {
  let assignResolver: AssignResolver;
  let mockContext: MyContext;
  let mockAssignedOrders: AssignedOrders[];

  beforeEach(() => {
    assignResolver = new AssignResolver();
    mockContext = mock<MyContext>();
    mockAssignedOrders = [mock<AssignedOrders>(), mock<AssignedOrders>()];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should fetch all assigned orders", async () => {
    // Create a mock repository
    const mockRepository = mock<Repository<AssignedOrders>>();
    const mockQueryBuilder = mock<typeorm.SelectQueryBuilder<AssignedOrders>>();
    mockQueryBuilder.leftJoinAndSelect.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.getManyAndCount.mockResolvedValue([
      mockAssignedOrders,
      mockAssignedOrders.length,
    ]);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Mock the getRepository function to return the mock repository
    (typeorm as any).getRepository.mockReturnValue(mockRepository);

    const resultPromise = assignResolver.getAllAssignedOrders(mockContext);

    // Use an asynchronous matcher to wait for the promise to resolve
    await expect(resultPromise).resolves.toEqual([
      mockAssignedOrders,
      mockAssignedOrders.length,
    ]);
  });

  it("should throw an ApolloError when an error occurs", async () => {
    // Create a mock repository
    const mockRepository = mock<Repository<AssignedOrders>>();
    mockRepository.find.mockRejectedValue(new Error("Database error"));

    // Mock the getRepository function to return the mock repository
    (typeorm.getRepository as jest.Mock).mockReturnValue(mockRepository);

    await expect(
      assignResolver.getAllAssignedOrders(mockContext)
    ).rejects.toThrow(ApolloError);
  });
});
