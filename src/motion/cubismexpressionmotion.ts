/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismSpec } from '../CubismSpec';
import { CubismModel } from '../model/cubismmodel';
import { ACubismMotion } from './acubismmotion';
import { CubismMotionQueueEntry } from './cubismmotionqueueentry';

// exp3.jsonのキーとデフォルト
const DefaultFadeTime = 1.0;

/**
 * 表情のモーション
 *
 * 表情のモーションクラス。
 */
export class CubismExpressionMotion extends ACubismMotion {
  static readonly DefaultAdditiveValue = 0.0; // 加算適用の初期値
  static readonly DefaultMultiplyValue = 1.0; // 乗算適用の初期値
  /**
   * インスタンスを作成する。
   * @param json expファイルが読み込まれているバッファ
   * @param size バッファのサイズ
   * @return 作成されたインスタンス
   */
  public static create(
    json: CubismSpec.ExpressionJSON
  ): CubismExpressionMotion {
    const expression: CubismExpressionMotion = new CubismExpressionMotion();
    expression.parse(json);
    return expression;
  }

  /**
   * モデルのパラメータの更新の実行
   * @param model 対象のモデル
   * @param userTimeSeconds デルタ時間の積算値[秒]
   * @param weight モーションの重み
   * @param motionQueueEntry CubismMotionQueueManagerで管理されているモーション
   */
  public doUpdateParameters(
    model: CubismModel,
    userTimeSeconds: number,
    weight: number,
    motionQueueEntry: CubismMotionQueueEntry
  ): void {
    for (let i = 0; i < this._parameters.length; ++i) {
      const parameter: ExpressionParameter = this._parameters[i];

      switch (parameter.blendType) {
        case ExpressionBlendType.Additive: {
          model.addParameterValueById(
            parameter.parameterId,
            parameter.value,
            weight
          );
          break;
        }
        case ExpressionBlendType.Multiply: {
          model.multiplyParameterValueById(
            parameter.parameterId,
            parameter.value,
            weight
          );
          break;
        }
        case ExpressionBlendType.Overwrite: {
          model.setParameterValueById(
            parameter.parameterId,
            parameter.value,
            weight
          );
          break;
        }
        default:
          // 仕様にない値を設定した時はすでに加算モードになっている
          break;
      }
    }
  }

  /**
  * @brief 表情によるモデルのパラメータの計算
  *
  * モデルの表情に関するパラメータを計算する。
  *
  * @param[in]   model                        対象のモデル
  * @param[in]   userTimeSeconds              デルタ時間の積算値[秒]
  * @param[in]   motionQueueEntry             CubismMotionQueueManagerで管理されているモーション
  * @param[in]   expressionParameterValues    モデルに適用する各パラメータの値
  * @param[in]   expressionIndex              表情のインデックス
  */
  public calculateExpressionParameters(
    model: CubismModel,
    userTimeSeconds: number,
    motionQueueEntry: CubismMotionQueueEntry,
    expressionParameterValues: ExpressionParameterValue[],
    expressionIndex: number
  ) {
    if (!motionQueueEntry.isAvailable()) {
      return;
    }
    if (!motionQueueEntry.isStarted()) {
      motionQueueEntry.setIsStarted(true);
      motionQueueEntry.setStartTime(userTimeSeconds - this._offsetSeconds); // モーションの開始時刻を記録
      motionQueueEntry.setFadeInStartTime(userTimeSeconds); // フェードインの開始時刻
      const duration = this.getDuration();
      if (motionQueueEntry.getEndTime() < 0.0) {
        // 開始していないうちに終了設定している場合がある
        motionQueueEntry.setEndTime(
          duration <= 0.0 ? -1 : motionQueueEntry.getStartTime() + duration
        );
        // duration == -1 の場合はループする
      }
    }
    this._fadeWeight = this.updateFadeWeight(motionQueueEntry, userTimeSeconds);
    // モデルに適用する値を計算
    for (let i = 0; i < expressionParameterValues.length; ++i) {
      const expressionParameterValue = expressionParameterValues[i];
      if (expressionParameterValue.parameterId == null) {
        continue;
      }
      const currentParameterValue = (expressionParameterValue.overwriteValue =
        model.getParameterValueById(expressionParameterValue.parameterId));
      const expressionParameters = this.getExpressionParameters();
      let parameterIndex = -1;
      for (let j = 0; j < expressionParameters.length; ++j) {
        if (
          expressionParameterValue.parameterId !=
          expressionParameters[j].parameterId
        ) {
          continue;
        }
        parameterIndex = j;
        break;
      }
      // 再生中のExpressionが参照していないパラメータは初期値を適用
      if (parameterIndex < 0) {
        if (expressionIndex == 0) {
          expressionParameterValue.additiveValue =
            CubismExpressionMotion.DefaultAdditiveValue;
          expressionParameterValue.multiplyValue =
            CubismExpressionMotion.DefaultMultiplyValue;
          expressionParameterValue.overwriteValue = currentParameterValue;
        } else {
          expressionParameterValue.additiveValue = this.calculateValue(
            expressionParameterValue.additiveValue,
            CubismExpressionMotion.DefaultAdditiveValue
          );
          expressionParameterValue.multiplyValue = this.calculateValue(
            expressionParameterValue.multiplyValue,
            CubismExpressionMotion.DefaultMultiplyValue
          );
          expressionParameterValue.overwriteValue = this.calculateValue(
            expressionParameterValue.overwriteValue,
            currentParameterValue
          );
        }
        continue;
      }
      // 値を計算
      const value = expressionParameters[parameterIndex].value;
      let newAdditiveValue, newMultiplyValue, newOverwriteValue;
      switch (expressionParameters[parameterIndex].blendType) {
        case ExpressionBlendType.Additive:
          newAdditiveValue = value;
          newMultiplyValue = CubismExpressionMotion.DefaultMultiplyValue;
          newOverwriteValue = currentParameterValue;
          break;
        case ExpressionBlendType.Multiply:
          newAdditiveValue = CubismExpressionMotion.DefaultAdditiveValue;
          newMultiplyValue = value;
          newOverwriteValue = currentParameterValue;
          break;
        case ExpressionBlendType.Overwrite:
          newAdditiveValue = CubismExpressionMotion.DefaultAdditiveValue;
          newMultiplyValue = CubismExpressionMotion.DefaultMultiplyValue;
          newOverwriteValue = value;
          break;
        default:
          return;
      }
      if (expressionIndex == 0) {
        expressionParameterValue.additiveValue = newAdditiveValue;
        expressionParameterValue.multiplyValue = newMultiplyValue;
        expressionParameterValue.overwriteValue = newOverwriteValue;
      } else {
        expressionParameterValue.additiveValue =
          expressionParameterValue.additiveValue * (1.0 - this._fadeWeight) +
          newAdditiveValue * this._fadeWeight;
        expressionParameterValue.multiplyValue =
          expressionParameterValue.multiplyValue * (1.0 - this._fadeWeight) +
          newMultiplyValue * this._fadeWeight;
        expressionParameterValue.overwriteValue =
          expressionParameterValue.overwriteValue * (1.0 - this._fadeWeight) +
          newOverwriteValue * this._fadeWeight;
      }
    }
  }
  /**
   * @brief 表情が参照しているパラメータを取得
   *
   * 表情が参照しているパラメータを取得する
   *
   * @return 表情パラメータ
   */
  public getExpressionParameters() {
    return this._parameters;
  }
  /**
   * @brief 表情のフェードの値を取得
   *
   * 現在の表情のフェードのウェイト値を取得する
   *
   * @returns 表情のフェードのウェイト値
   */
  public getFadeWeight() {
    return this._fadeWeight;
  }

  protected parse(json: CubismSpec.ExpressionJSON) {
    if(!json){
      return;
    }
    this.setFadeInTime(
      json.FadeInTime != undefined ? json.FadeInTime : DefaultFadeTime
    ); // フェードイン
    this.setFadeOutTime(
      json.FadeOutTime != undefined ? json.FadeOutTime : DefaultFadeTime
    ); // フェードアウト

    // 各パラメータについて
    const parameterCount = (json.Parameters || []).length;

    for (let i = 0; i < parameterCount; ++i) {
      const param = json.Parameters[i];
      const parameterId = param.Id; // パラメータID

      const value = param.Value; // 値

      // 計算方法の設定
      let blendType: ExpressionBlendType;

      if (!param.Blend || param.Blend === 'Add') {
        blendType = ExpressionBlendType.Additive;
      } else if (param.Blend === 'Multiply') {
        blendType = ExpressionBlendType.Multiply;
      } else if (param.Blend === 'Overwrite') {
        blendType = ExpressionBlendType.Overwrite;
      } else {
        // その他 仕様にない値を設定した時は加算モードにすることで復旧
        blendType = ExpressionBlendType.Additive;
      }

      // 設定オブジェクトを作成してリストに追加する
      const item: ExpressionParameter = {
        parameterId,
        blendType,
        value,
      };

      this._parameters.push(item);
    }
  }

  /**
 * @brief ブレンド計算
 *
 * 入力された値でブレンド計算をする。
 *
 * @param source 現在の値
 * @param destination 適用する値
 * @param weight ウェイト
 * @returns 計算結果
 */
  public calculateValue(source: number, destination: number): number {
    return source * (1.0 - this._fadeWeight) + destination * this._fadeWeight;
  }


  /**
   * コンストラクタ
   */
  protected constructor() {
    super();

    this._parameters = [];
    this._fadeWeight = 0.0;
  }

  _parameters: ExpressionParameter[]; // 表情のパラメータ情報リスト
  _fadeWeight: number; // 表情の現在のウェイト
}

/**
 * 表情パラメータ値の計算方式
 */
export enum ExpressionBlendType {
  Additive = 0, // 加算
  Multiply = 1, // 乗算
  Overwrite = 2 // 上書き
}

/**
 * 表情のパラメータ情報
 */
export interface ExpressionParameter {
  parameterId: string; // パラメータID
  blendType: ExpressionBlendType; // パラメータの演算種類
  value: number; // 値
}

import { ExpressionParameterValue } from './cubismexpressionmotionmanager';