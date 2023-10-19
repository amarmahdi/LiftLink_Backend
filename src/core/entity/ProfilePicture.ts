import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, BaseEntity, ManyToOne } from "typeorm";
import { ObjectType, Field, InputType } from "type-graphql";
import { User } from "./User";

@ObjectType()
@Entity()
export class ProfilePicture extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  pictureId!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  pictureLink!: string;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, user => user.profilePicture)
  user!: User;

  @Field({ nullable: true })
  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Field({ defaultValue: true })
  @Column({ default: true })
  isCurrent!: boolean;
}