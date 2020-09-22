/* Written by Ye Liu */

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `journal_book` (
  `journal_book_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐本id',
  `open_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'open_id',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐本名称',
  `background_id` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图id',
  `count` int(100) NOT NULL COMMENT '手帐数',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

ALTER TABLE `journal_book`
  ADD PRIMARY KEY (`journal_book_id`),
  ADD KEY `journal_book_open_id` (`open_id`);

ALTER TABLE `journal_book`
  ADD CONSTRAINT `journal_book_open_id` FOREIGN KEY (`open_id`) REFERENCES `cSessionInfo` (`open_id`);
COMMIT;
