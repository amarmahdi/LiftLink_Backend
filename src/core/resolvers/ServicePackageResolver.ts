import { Resolver, Query, Arg, Authorized, Ctx, Mutation } from "type-graphql";
import { ServicePackages } from "../entity/ServicePackages";
import { Dealership } from "../entity/Dealership";
import { User } from "../entity/User";
import { AccountType } from "../types/AccountTypes";
import { ServicePackageInput } from "../inputs/ServicePackageInput";
import { getUser } from "./UserInfo";

@Resolver()
export class ServicePackageResolver {
  @Query(() => [ServicePackages])
  async getServicePackages(
    @Arg("dealershipId") dealershipId: string
  ): Promise<ServicePackages[]> {
    try {
      const servicePackages = await ServicePackages.find({
        where: { dealershipId: dealershipId },
        relations: ["dealership"],
      });
      if (!servicePackages) throw new Error("No service packages found");
      return servicePackages;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to get service packages");
    }
  }

  @Query(() => ServicePackages)
  async getServicePackage(
    @Arg("servicePackageId") servicePackageId: string
  ): Promise<ServicePackages> {
    try {
      const servicePackage = await ServicePackages.findOne({
        relations: ["dealership"],
        where: { servicePackageId: servicePackageId },
      });
      if (!servicePackage) throw new Error("No service package found");
      return servicePackage;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to get service package");
    }
  }

  @Query(() => [ServicePackages])
  async searchServicePackages(
    @Arg("searchTerm") searchTerm: string
  ): Promise<ServicePackages[]> {
    try {
      const servicePackages = await ServicePackages.find({
        where: {
          servicePackageName: searchTerm,
        },
      });
      if (!servicePackages) throw new Error("No service packages found");
      return servicePackages;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to search service packages");
    }
  }

  @Mutation(() => ServicePackages)
  @Authorized()
  async createServicePackage(
    @Arg("input")
    {
      servicePackageName,
      servicePackageDescription,
      servicePackagePrice,
      servicePackageDuration,
      servicePackageType,
      dealershipId,
    }: ServicePackageInput,
    @Ctx() ctx: any
  ): Promise<ServicePackages> {
    try {
      const user = await getUser({ username: ctx.payload.username });
      if (!user) throw new Error("No user found");
      if (user.accountType !== AccountType.ADMIN.valueOf())
        throw new Error("Only dealerships can create service packages");
      if (!dealershipId) throw new Error("Dealership ID required");
      const dealership = await Dealership.findOne({
        where: { dealershipId: dealershipId },
      });
      if (!dealership) throw new Error("No dealership found");
      if (!servicePackageName) throw new Error("Service package name required");
      if (!servicePackageDescription)
        throw new Error("Service package description required");
      if (!servicePackagePrice)
        throw new Error("Service package price required");

      const getServicePackage = await ServicePackages.findOne({
        where: { servicePackageName: servicePackageName },
      });
      if (getServicePackage)
        throw new Error("Service package with that name already exists");

      const servicePackage = await ServicePackages.create({
        servicePackageName,
        servicePackageDescription,
        servicePackagePrice,
        servicePackageDuration,
        servicePackageType,
        dealershipId,
        dealership,
      }).save();
      return servicePackage;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to create service package");
    }
  }
}
