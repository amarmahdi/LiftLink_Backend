import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { User } from "./User";

export enum TokenType {
  ACCESS = "access",
  REFRESH = "refresh",
}

@Entity()
@ObjectType()
export class Token extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.tokens)
  user!: User;

  @Field()
  @Column()
  token!: string;

  @Field()
  @Column()
  type!: TokenType;

  @Field()
  @Column()
  expiresAt!: Date;
}
