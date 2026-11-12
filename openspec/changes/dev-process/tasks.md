# Tasks

## 1. 文档补正（实现中发现的缺口）

- [x] 1.1 80/02 §3 与 80/03 §1 补「G5 同样按基线棘轮执行，直到 docs-coverage-baseline 清零」，docs-sync 记偏差（依据：design.md 决策 6；验证：check-links、check-terms 通过）

## 2. G1–G3 变更门禁

- [x] 2.1 实现 `docs/_tools/check-change-impact.py --gate link|review|impact|all`（依据：docs/80-process/03 §1、§2；验证：在仓库的本地临时克隆中构造合规与不合规的变更与分支，各门禁的通过与失败用例全部符合预期）
- [x] 2.2 对本仓库两个进行中的变更运行：`dev-process` 三项通过；`design-language-v3` 的 G3 因回写记录尚空而失败且原因正确（依据：同上；验证：命令输出）

## 3. G4 需求覆盖

- [x] 3.1 实现 `docs/_tools/check-req-coverage.py`（含 `--write-baseline`、`--json`）（依据：docs/80-process/02 §1；验证：解析出的需求数与 PRD 标题数一致；构造缺口与豁免用例）
- [x] 3.2 生成 `docs/_tools/req-coverage-baseline.json`，抽样核对缺口为真（依据：02 §1.3；验证：抽样记录写入 docs-sync）

## 4. G5 文档引用反查

- [x] 4.1 实现 `docs/_tools/check-doc-refs.py`（六类引用、`--write-baseline`、`--json`）（依据：docs/80-process/02 §3；验证：构造每类的正确与错误引用用例）
- [x] 4.2 生成 `docs/_tools/doc-refs-baseline.json`，抽样核对失配为真（依据：同上；验证：抽样记录写入 docs-sync）

## 5. 文档站与登记

- [x] 5.1 `gen-docs-site.py` 加入 80-process 分区，决策面板与首页「裁决进度」纳入 rulings §4.25（依据：docs/_tools/README「文档站」；验证：生成站点，80 分区与 §4.25 卡片出现，站内锚点 0 失配）
- [x] 5.2 `docs/_tools/README.md` 登记三个脚本与两个基线文件；仓库根 `CLAUDE.md`「检查」加入三个脚本（依据：docs/80-process/03 §5；验证：check-links 通过）

## 6. 收尾

- [x] 6.1 全部文档检查与 G1–G5 运行结果写入 docs-sync「检查结果」（验证：全部通过或按棘轮通过）
