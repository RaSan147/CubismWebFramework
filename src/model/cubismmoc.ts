/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismModel } from './cubismmodel';

/**
 * Mocデータの管理
 *
 * Mocデータの管理を行うクラス。
 */
export class CubismMoc {
  /**
   * Mocデータの作成
   */
  public static create(
    mocBytes: ArrayBuffer,
    shouldCheckMocConsistency: boolean
  ): CubismMoc {
    if (shouldCheckMocConsistency) {
      // .moc3の整合性を確認
      const consistency = this.hasMocConsistency(mocBytes);

      if (!consistency) {
        // 整合性が確認できなければ処理しない
        throw new Error(`Inconsistent MOC3.`);
      }
    }

    const moc: Live2DCubismCore.Moc =
      Live2DCubismCore.Moc.fromArrayBuffer(mocBytes);

    if (moc) {
      const cubismMoc = new CubismMoc(moc);
      cubismMoc._mocVersion = Live2DCubismCore.Version.csmGetMocVersion(
        moc,
        mocBytes
      );
      return cubismMoc;
    }

    throw new Error('Failed to CubismMoc.create().');
  }

  /**
   * モデルを作成する
   *
   * @return Mocデータから作成されたモデル
   */
  createModel(): CubismModel {
    let cubismModel: CubismModel;

    const model: Live2DCubismCore.Model = Live2DCubismCore.Model.fromMoc(
      this._moc
    );

    if (model) {
      cubismModel = new CubismModel(model);

      ++this._modelCount;

      return cubismModel;
    }

    throw new Error('Unknown error');
  }

  /**
   * モデルを削除する
   */
  deleteModel(model: CubismModel): void {
    if (model != null) {
      --this._modelCount;
    }
  }

  /**
   * コンストラクタ
   */
  private constructor(moc: Live2DCubismCore.Moc) {
    this._moc = moc;
    this._modelCount = 0;
    this._mocVersion = 0;
  }

  /**
   * デストラクタ相当の処理
   */
  public release(): void {
    this._moc._release();
    (this as Partial<this>)._moc = undefined;
  }

  /**
   * 最新の.moc3 Versionを取得
   */
  public getLatestMocVersion(): number {
    return Live2DCubismCore.Version.csmGetLatestMocVersion();
  }

  /**
   * 読み込んだモデルの.moc3 Versionを取得
   */
  public getMocVersion(): number {
    return this._mocVersion;
  }

  /**
   * .moc3 の整合性を検証する
   */
  public static hasMocConsistency(mocBytes: ArrayBuffer): boolean {
    const isConsistent =
      Live2DCubismCore.Moc.prototype.hasMocConsistency(mocBytes);
    return isConsistent === 1 ? true : false;
  }

  _moc: Live2DCubismCore.Moc; // Mocデータ
  _modelCount: number; // Mocデータから作られたモデルの個数
  _mocVersion: number; // 読み込んだモデルの.moc3 Version
}
