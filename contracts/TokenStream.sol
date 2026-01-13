// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenStream
 * @notice ERC-20 token streaming with linear vesting and optional cliff
 * @dev Streams are immutable once created (no cancellation)
 * @author MonOps
 */
contract TokenStream is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Stream {
        address sender;         // Stream creator
        address recipient;      // Token receiver
        address token;          // ERC-20 token address
        uint256 depositAmount;  // Total amount deposited
        uint256 startTime;      // When streaming begins
        uint256 endTime;        // When streaming ends
        uint256 cliffEnd;       // End of cliff period (0 = no cliff)
        uint256 withdrawn;      // Amount already withdrawn
    }

    // Stream ID counter
    uint256 public nextStreamId;

    // Stream ID => Stream data
    mapping(uint256 => Stream) public streams;

    // User => Stream IDs where they are sender
    mapping(address => uint256[]) public senderStreams;

    // User => Stream IDs where they are recipient
    mapping(address => uint256[]) public recipientStreams;

    // Events
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

    /**
     * @notice Create a new token stream
     * @param recipient Address to receive streamed tokens
     * @param token ERC-20 token address
     * @param amount Total amount to stream
     * @param startTime When streaming begins (must be >= now)
     * @param endTime When streaming ends (must be > startTime)
     * @param cliffDuration Cliff period in seconds (0 for no cliff)
     * @return streamId The ID of the created stream
     */
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

        // Calculate cliff end time
        uint256 cliffEnd = cliffDuration > 0 ? startTime + cliffDuration : 0;

        // Transfer tokens from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create stream
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

        // Track stream for both parties
        senderStreams[msg.sender].push(streamId);
        recipientStreams[recipient].push(streamId);

        emit StreamCreated(
            streamId,
            msg.sender,
            recipient,
            token,
            amount,
            startTime,
            endTime,
            cliffEnd
        );
    }

    /**
     * @notice Create multiple streams in a single transaction (batch)
     * @param recipients Array of recipient addresses
     * @param token ERC-20 token address (same for all)
     * @param amounts Array of amounts to stream
     * @param startTime When all streams begin
     * @param endTime When all streams end
     * @param cliffDuration Cliff period for all streams
     * @return streamIds Array of created stream IDs
     */
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

        // Calculate total amount needed
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be > 0");
            totalAmount += amounts[i];
        }

        // Transfer total tokens upfront
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Create streams
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

            emit StreamCreated(
                streamId,
                msg.sender,
                recipients[i],
                token,
                amounts[i],
                startTime,
                endTime,
                cliffEnd
            );
        }
    }

    /**
     * @notice Calculate the amount that can be withdrawn from a stream
     * @param streamId Stream ID to query
     * @return withdrawable Amount available to withdraw
     */
    function getWithdrawableAmount(uint256 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];

        if (stream.depositAmount == 0) return 0;

        uint256 streamed;

        if (block.timestamp < stream.startTime) {
            // Stream hasn't started
            streamed = 0;
        } else if (stream.cliffEnd > 0 && block.timestamp < stream.cliffEnd) {
            // Still in cliff period - nothing available
            streamed = 0;
        } else if (block.timestamp >= stream.endTime) {
            // Stream complete - all tokens available
            streamed = stream.depositAmount;
        } else {
            // Linear vesting in progress
            uint256 elapsed = block.timestamp - stream.startTime;
            uint256 duration = stream.endTime - stream.startTime;
            streamed = (stream.depositAmount * elapsed) / duration;
        }

        // Return amount not yet withdrawn
        return streamed > stream.withdrawn ? streamed - stream.withdrawn : 0;
    }

    /**
     * @notice Withdraw available tokens from a stream
     * @param streamId Stream ID to withdraw from
     * @return amount Amount withdrawn
     */
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

    /**
     * @notice Withdraw from multiple streams in a single transaction
     * @param streamIds Array of stream IDs to withdraw from
     * @return totalAmount Total amount withdrawn across all streams
     */
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

    /**
     * @notice Get stream details
     * @param streamId Stream ID to query
     */
    function getStream(uint256 streamId) external view returns (
        address sender,
        address recipient,
        address token,
        uint256 depositAmount,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffEnd,
        uint256 withdrawn
    ) {
        Stream storage stream = streams[streamId];
        return (
            stream.sender,
            stream.recipient,
            stream.token,
            stream.depositAmount,
            stream.startTime,
            stream.endTime,
            stream.cliffEnd,
            stream.withdrawn
        );
    }

    /**
     * @notice Get all stream IDs where user is sender
     * @param user User address
     */
    function getSenderStreams(address user) external view returns (uint256[] memory) {
        return senderStreams[user];
    }

    /**
     * @notice Get all stream IDs where user is recipient
     * @param user User address
     */
    function getRecipientStreams(address user) external view returns (uint256[] memory) {
        return recipientStreams[user];
    }

    /**
     * @notice Get stream count for a sender
     * @param user User address
     */
    function getSenderStreamCount(address user) external view returns (uint256) {
        return senderStreams[user].length;
    }

    /**
     * @notice Get stream count for a recipient
     * @param user User address
     */
    function getRecipientStreamCount(address user) external view returns (uint256) {
        return recipientStreams[user].length;
    }

    /**
     * @notice Calculate streaming rate (tokens per second)
     * @param streamId Stream ID to query
     */
    function getStreamRate(uint256 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.depositAmount == 0) return 0;

        uint256 duration = stream.endTime - stream.startTime;
        return stream.depositAmount / duration;
    }

    /**
     * @notice Get the remaining balance in a stream
     * @param streamId Stream ID to query
     */
    function getRemainingBalance(uint256 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        return stream.depositAmount - stream.withdrawn;
    }
}
