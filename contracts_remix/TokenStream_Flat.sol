// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/IERC20.sol)
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/IERC20Permit.sol)
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Address.sol)
library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/utils/SafeERC20.sol)
library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

/**
 * @title TokenStream
 * @notice ERC-20 token streaming with linear vesting and optional cliff
 * @dev Streams are immutable once created (no cancellation)
 * @author MonOps
 */
contract TokenStream is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Stream {
        address sender;
        address recipient;
        address token;
        uint256 depositAmount;
        uint256 startTime;
        uint256 endTime;
        uint256 cliffEnd;
        uint256 withdrawn;
    }

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) public senderStreams;
    mapping(address => uint256[]) public recipientStreams;

    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 depositAmount,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffEnd
    );

    event TokensWithdrawn(
        uint256 indexed streamId,
        address indexed recipient,
        uint256 amount
    );

    function createStream(
        address recipient,
        address token,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffDuration
    ) external nonReentrant returns (uint256 streamId) {
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Cannot stream to self");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(startTime >= block.timestamp, "Start must be >= now");
        require(endTime > startTime, "End must be > start");
        require(startTime + cliffDuration <= endTime, "Cliff exceeds duration");

        uint256 cliffEnd = cliffDuration > 0 ? startTime + cliffDuration : 0;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        streamId = nextStreamId++;
        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            depositAmount: amount,
            startTime: startTime,
            endTime: endTime,
            cliffEnd: cliffEnd,
            withdrawn: 0
        });

        senderStreams[msg.sender].push(streamId);
        recipientStreams[recipient].push(streamId);

        emit StreamCreated(streamId, msg.sender, recipient, token, amount, startTime, endTime, cliffEnd);
    }

    function createStreamBatch(
        address[] calldata recipients,
        address token,
        uint256[] calldata amounts,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffDuration
    ) external nonReentrant returns (uint256[] memory streamIds) {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length > 0, "Empty batch");
        require(recipients.length <= 100, "Batch too large");
        require(token != address(0), "Invalid token");
        require(startTime >= block.timestamp, "Start must be >= now");
        require(endTime > startTime, "End must be > start");
        require(startTime + cliffDuration <= endTime, "Cliff exceeds duration");

        uint256 cliffEnd = cliffDuration > 0 ? startTime + cliffDuration : 0;
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be > 0");
            totalAmount += amounts[i];
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        streamIds = new uint256[](recipients.length);
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(recipients[i] != msg.sender, "Cannot stream to self");

            uint256 streamId = nextStreamId++;
            streams[streamId] = Stream({
                sender: msg.sender,
                recipient: recipients[i],
                token: token,
                depositAmount: amounts[i],
                startTime: startTime,
                endTime: endTime,
                cliffEnd: cliffEnd,
                withdrawn: 0
            });

            senderStreams[msg.sender].push(streamId);
            recipientStreams[recipients[i]].push(streamId);
            streamIds[i] = streamId;

            emit StreamCreated(streamId, msg.sender, recipients[i], token, amounts[i], startTime, endTime, cliffEnd);
        }
    }

    function getWithdrawableAmount(uint256 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.depositAmount == 0) return 0;

        uint256 streamed;
        if (block.timestamp < stream.startTime) {
            streamed = 0;
        } else if (stream.cliffEnd > 0 && block.timestamp < stream.cliffEnd) {
            streamed = 0;
        } else if (block.timestamp >= stream.endTime) {
            streamed = stream.depositAmount;
        } else {
            uint256 elapsed = block.timestamp - stream.startTime;
            uint256 duration = stream.endTime - stream.startTime;
            streamed = (stream.depositAmount * elapsed) / duration;
        }

        return streamed > stream.withdrawn ? streamed - stream.withdrawn : 0;
    }

    function withdraw(uint256 streamId) external nonReentrant returns (uint256 amount) {
        Stream storage stream = streams[streamId];
        require(stream.recipient == msg.sender, "Not recipient");
        require(stream.depositAmount > 0, "Stream not found");

        amount = getWithdrawableAmount(streamId);
        require(amount > 0, "Nothing to withdraw");

        stream.withdrawn += amount;
        IERC20(stream.token).safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(streamId, msg.sender, amount);
    }

    function withdrawBatch(uint256[] calldata streamIds) external nonReentrant returns (uint256 totalAmount) {
        require(streamIds.length > 0, "Empty batch");
        require(streamIds.length <= 50, "Batch too large");

        for (uint256 i = 0; i < streamIds.length; i++) {
            Stream storage stream = streams[streamIds[i]];
            if (stream.recipient != msg.sender) continue;
            if (stream.depositAmount == 0) continue;

            uint256 amount = getWithdrawableAmount(streamIds[i]);
            if (amount == 0) continue;

            stream.withdrawn += amount;
            totalAmount += amount;
            IERC20(stream.token).safeTransfer(msg.sender, amount);
            emit TokensWithdrawn(streamIds[i], msg.sender, amount);
        }

        require(totalAmount > 0, "Nothing to withdraw");
    }

    function getStream(uint256 streamId) external view returns (
        address sender, address recipient, address token, uint256 depositAmount,
        uint256 startTime, uint256 endTime, uint256 cliffEnd, uint256 withdrawn
    ) {
        Stream storage stream = streams[streamId];
        return (stream.sender, stream.recipient, stream.token, stream.depositAmount,
                stream.startTime, stream.endTime, stream.cliffEnd, stream.withdrawn);
    }

    function getSenderStreams(address user) external view returns (uint256[] memory) {
        return senderStreams[user];
    }

    function getRecipientStreams(address user) external view returns (uint256[] memory) {
        return recipientStreams[user];
    }

    function getSenderStreamCount(address user) external view returns (uint256) {
        return senderStreams[user].length;
    }

    function getRecipientStreamCount(address user) external view returns (uint256) {
        return recipientStreams[user].length;
    }

    function getStreamRate(uint256 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.depositAmount == 0) return 0;
        uint256 duration = stream.endTime - stream.startTime;
        return stream.depositAmount / duration;
    }

    function getRemainingBalance(uint256 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        return stream.depositAmount - stream.withdrawn;
    }
}
