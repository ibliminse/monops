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
 * @title TokenLock
 * @notice Lock ERC-20 tokens with optional linear vesting
 * @dev Supports both simple time locks and vesting schedules with cliff periods
 */
contract TokenLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address owner;
        address token;
        uint256 amount;
        uint256 claimed;
        uint256 startTime;
        uint256 endTime;
        uint256 cliffEnd;
        bool isVesting;
    }

    uint256 public nextLockId;
    mapping(uint256 => Lock) public locks;
    mapping(address => uint256[]) public userLocks;

    event LockCreated(
        uint256 indexed lockId,
        address indexed owner,
        address indexed token,
        uint256 amount,
        uint256 unlockTime,
        bool isVesting
    );

    event TokensClaimed(
        uint256 indexed lockId,
        address indexed owner,
        uint256 amount
    );

    function createLock(
        address token,
        uint256 amount,
        uint256 unlockTime
    ) external nonReentrant returns (uint256 lockId) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(unlockTime > block.timestamp, "Unlock time must be future");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        lockId = nextLockId++;
        locks[lockId] = Lock({
            owner: msg.sender,
            token: token,
            amount: amount,
            claimed: 0,
            startTime: block.timestamp,
            endTime: unlockTime,
            cliffEnd: 0,
            isVesting: false
        });

        userLocks[msg.sender].push(lockId);
        emit LockCreated(lockId, msg.sender, token, amount, unlockTime, false);
    }

    function createVestingLock(
        address token,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffDuration
    ) external nonReentrant returns (uint256 lockId) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(startTime >= block.timestamp, "Start must be >= now");
        require(endTime > startTime, "End must be > start");
        require(startTime + cliffDuration <= endTime, "Cliff exceeds vesting");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        lockId = nextLockId++;
        locks[lockId] = Lock({
            owner: msg.sender,
            token: token,
            amount: amount,
            claimed: 0,
            startTime: startTime,
            endTime: endTime,
            cliffEnd: startTime + cliffDuration,
            isVesting: true
        });

        userLocks[msg.sender].push(lockId);
        emit LockCreated(lockId, msg.sender, token, amount, endTime, true);
    }

    function getClaimableAmount(uint256 lockId) public view returns (uint256) {
        Lock storage lock = locks[lockId];
        if (lock.amount == 0) return 0;

        uint256 vested;
        if (lock.isVesting) {
            if (block.timestamp < lock.cliffEnd) {
                vested = 0;
            } else if (block.timestamp >= lock.endTime) {
                vested = lock.amount;
            } else {
                uint256 elapsed = block.timestamp - lock.startTime;
                uint256 duration = lock.endTime - lock.startTime;
                vested = (lock.amount * elapsed) / duration;
            }
        } else {
            if (block.timestamp >= lock.endTime) {
                vested = lock.amount;
            } else {
                vested = 0;
            }
        }

        return vested > lock.claimed ? vested - lock.claimed : 0;
    }

    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage lock = locks[lockId];
        require(lock.owner == msg.sender, "Not lock owner");
        require(lock.amount > 0, "Lock not found");

        uint256 claimable = getClaimableAmount(lockId);
        require(claimable > 0, "Nothing to claim");

        lock.claimed += claimable;
        IERC20(lock.token).safeTransfer(msg.sender, claimable);
        emit TokensClaimed(lockId, msg.sender, claimable);
    }

    function getLock(uint256 lockId) external view returns (
        address owner, address token, uint256 amount, uint256 claimed,
        uint256 startTime, uint256 endTime, uint256 cliffEnd, bool isVesting
    ) {
        Lock storage lock = locks[lockId];
        return (lock.owner, lock.token, lock.amount, lock.claimed,
                lock.startTime, lock.endTime, lock.cliffEnd, lock.isVesting);
    }

    function getUserLocks(address user) external view returns (uint256[] memory) {
        return userLocks[user];
    }

    function getUserLockCount(address user) external view returns (uint256) {
        return userLocks[user].length;
    }
}
