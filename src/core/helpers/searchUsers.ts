import { Brackets } from "typeorm";
import { User } from "../entity/User";
import { Dealership } from "../entity/Dealership";

export const searchUsers = async (
  searchTerm: string,
  accountType: string
): Promise<User[]> => {
  let query = User.createQueryBuilder("user");

  if (searchTerm) {
    searchTerm = searchTerm.toLowerCase();
    query = query.andWhere(
      new Brackets((qb) => {
        qb.where("similarity(user.username, :searchTerm) > 0.2", {
          searchTerm,
        })
          .orWhere("similarity(user.email, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere("similarity(user.phoneNumber, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere("similarity(user.firstName, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere("similarity(user.lastName, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere("similarity(user.accountType, :searchTerm) > 0.2", {
            searchTerm,
          });
      })
    );
  }

  const users = await query.getMany();
  if (users.length === 0) throw new Error("No users found");
  const newUser = users.reduce((acc: User[], curr) => {
    if (curr.accountType === accountType) {
      acc.push(curr);
    }
    return acc;
  }, []);
  return newUser as User[];
};

export const searchDealerships = async (
  searchTerm: string,
  excludeIds?: string[]
): Promise<Dealership[]> => {
  let query = Dealership.createQueryBuilder("dealership").leftJoinAndSelect(
    "dealership.servicePackages",
    "servicePackage"
  );
  if (searchTerm) {
    searchTerm = searchTerm.toLowerCase();
    query = query.andWhere(
      new Brackets((qb) => {
        if (excludeIds && excludeIds.length > 0) {
          qb = qb.where("dealership.dealershipId NOT IN (:...excludeIds)", {
            excludeIds,
          });
        }
        qb.andWhere(
          "similarity(dealership.dealershipName, :searchTerm) > 0.2",
          {
            searchTerm,
          }
        )
          .orWhere(
            "similarity(dealership.dealershipEmail, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipPhoneNumber, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipAddress, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere("similarity(dealership.dealershipCity, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere(
            "similarity(dealership.dealershipState, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipZipCode, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipCountry, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipWebsite, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere("similarity(dealership.dealershipLogo, :searchTerm) > 0.2", {
            searchTerm,
          })
          .orWhere(
            "similarity(dealership.dealershipDescription, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          )
          .orWhere(
            "similarity(dealership.dealershipHours, :searchTerm) > 0.2",
            {
              searchTerm,
            }
          );
      })
    );
  }

  const dealerships = await query.getMany();
  if (dealerships.length === 0) [];
  return dealerships as Dealership[];
};
