// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

contract PythStructs {
    struct Price {
        int64  price;
        uint64 conf;
        int32  expo;
        uint   publishTime;
    }
}

interface IPyth {
    function getPriceNoOlderThan(bytes32 id, uint age)
        external view returns (PythStructs.Price memory price);

    function getUpdateFee(bytes[] calldata updateData)
        external view returns (uint feeAmount);

    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
