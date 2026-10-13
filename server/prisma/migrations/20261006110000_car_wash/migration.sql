-- Marketplace listings are not kept.
DELETE FROM `Notification`;
DELETE FROM `ReviewReport`;
DELETE FROM `ReviewPhoto`;
DELETE FROM `Review`;
DELETE FROM `Booking`;
DELETE FROM `BusinessPhoto`;
DELETE FROM `BusinessWorkingHour`;
DELETE FROM `Service`;
DELETE FROM `Business`;
DELETE FROM `RefreshToken` WHERE `userId` IN (SELECT `id` FROM `User` WHERE `role` = 'ADMIN');
DELETE FROM `User` WHERE `role` = 'ADMIN';

ALTER TABLE `Business` DROP FOREIGN KEY `Business_categoryId_fkey`;

DROP INDEX `Business_approvalStatus_categoryId_idx` ON `Business`;
DROP INDEX `Business_categoryId_fkey` ON `Business`;

-- The unique (userId, businessId) index also serves the user foreign key.
CREATE INDEX `Review_userId_idx` ON `Review`(`userId`);
DROP INDEX `Review_userId_businessId_key` ON `Review`;

ALTER TABLE `Booking` ADD COLUMN `color` VARCHAR(40) NULL,
    ADD COLUMN `make` VARCHAR(80) NULL,
    ADD COLUMN `registration` VARCHAR(32) NOT NULL,
    ADD COLUMN `vehicleSize` ENUM('HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN') NOT NULL,
    MODIFY `status` ENUM('CONFIRMED', 'ARRIVED', 'WASHING', 'READY', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED';

ALTER TABLE `Business` DROP COLUMN `approvalStatus`,
    DROP COLUMN `categoryId`,
    DROP COLUMN `rejectionReason`,
    ADD COLUMN `bayCount` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `phoneContactName` VARCHAR(80) NOT NULL,
    ADD COLUMN `secondaryContactName` VARCHAR(80) NOT NULL,
    ADD COLUMN `secondaryPhone` VARCHAR(32) NOT NULL;

ALTER TABLE `Notification` MODIFY `type` ENUM('BOOKING_CONFIRMATION', 'BOOKING_CANCELLATION', 'BOOKING_REMINDER', 'BOOKING_RESCHEDULED', 'CAR_READY', 'NEW_REVIEW', 'REVIEW_REPLY') NOT NULL;

ALTER TABLE `Service` DROP COLUMN `durationMinutes`,
    DROP COLUMN `price`,
    MODIFY `icon` VARCHAR(64) NOT NULL DEFAULT 'car-sport-outline';

ALTER TABLE `User` MODIFY `role` ENUM('CUSTOMER', 'BUSINESS_OWNER') NOT NULL;

DROP TABLE `Category`;

CREATE TABLE `ServicePrice` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `vehicleSize` ENUM('HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN') NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,

    UNIQUE INDEX `ServicePrice_serviceId_vehicleSize_key`(`serviceId`, `vehicleSize`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(32) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `registration` VARCHAR(32) NOT NULL,
    `vehicleSize` ENUM('HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN') NOT NULL,
    `packageName` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `tax` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_bookingId_key`(`bookingId`),
    UNIQUE INDEX `Invoice_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServicePrice` ADD CONSTRAINT `ServicePrice_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
