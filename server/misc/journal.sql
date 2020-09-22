/* Written by Ye Liu */

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `journal` (
  `journal_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐id',
  `journal_book_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐本id',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐标题',
  `previewUrl` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '预览图地址',
  `components` varchar(5000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手帐组件',
  `last_update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后修改时间'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

ALTER TABLE `journal`
  ADD PRIMARY KEY (`journal_id`),
  ADD KEY `journal_book_id` (`journal_book_id`);

ALTER TABLE `journal`
  ADD CONSTRAINT `journal_book_id` FOREIGN KEY (`journal_book_id`) REFERENCES `journal_book` (`journal_book_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
